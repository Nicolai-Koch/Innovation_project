import { get, writable } from 'svelte/store';
import { createUSBBus, CONNECTION_STATE, JDBus, JDDevice } from 'jacdac-ts';
import {
  CHANGE,
  ButtonEvent,
  DEVICE_ANNOUNCE,
  DEVICE_CHANGE,
  ButtonReg,
  LedReg,
  PotentiometerReg,
  RotaryEncoderReg,
  SRV_BUTTON,
  SRV_LED,
  SRV_POTENTIOMETER,
  SRV_ROTARY_ENCODER,
} from 'jacdac-ts';
import type { JDService } from 'jacdac-ts';
import Microbits from '../microbit-interfacing/Microbits';
import { stores } from '../stores/Stores';
import {
  confirmTeamColor,
  GamePhase,
  getTeamColorIdAtIndex,
  isColorLockedForTeam,
  setTeamColorConfirmation,
  setGamePhase,
  setTeamColorByIndex,
  teamAColorId,
  teamAConfirmed,
  teamBColorId,
  teamBConfirmed,
  teamColorPalette,
} from '../stores/TeamGameStore';
import { Paths, navigate } from '../../router/Router';

// Initialize the Jacdac bus - single instance for entire app
let busInstance: JDBus | null = null;
let isInitialized = false;

function getBus(): JDBus {
  if (!busInstance) {
    busInstance = createUSBBus();
    busInstance.streaming = true;
    // Keep a reference to prevent garbage collection
    (globalThis as any).__jacdacBus = busInstance;
  }
  return busInstance;
}

export const bus: JDBus = getBus();

// Writable stores for reactive state
export const connected = writable(false);
export const devices = writable<JDDevice[]>([]);
export const error = writable<string | null>(null);

function getVisibleDevices(currentBus: JDBus): JDDevice[] {
  // Show only real announced, non-infrastructure devices.
  // This avoids showing the built-in simulator/infrastructure pseudo-device.
  return currentBus.devices({
    announced: true,
    ignoreInfrastructure: true,
  });
}

// Initialize bus listeners (call once on app startup)
export function initializeBus() {
  if (isInitialized) return;
  isInitialized = true;

  const currentBus = getBus();

  // Subscribe to connection state changes
  currentBus.on(CONNECTION_STATE, () => {
    connected.set(currentBus.connected);
    console.log('Jacdac connection state:', currentBus.connected);
  });

  const updateDevices = () => {
    const deviceList = getVisibleDevices(currentBus);
    devices.set(deviceList);
    const serviceClasses = deviceList.flatMap(device =>
      device.services().map(service => `0x${service.serviceClass.toString(16)}`)
    );
    const buttonDevices = deviceList.filter(device => device.hasService(SRV_BUTTON)).length;
    console.log('Devices updated (real only):', deviceList.length, serviceClasses);
    console.log('Jacdac button devices detected:', buttonDevices);
  };

  // Subscribe to canonical bus change events.
  currentBus.on(CHANGE, updateDevices);
  currentBus.on(DEVICE_ANNOUNCE, updateDevices);
  currentBus.on(DEVICE_CHANGE, updateDevices);

  // Set initial state
  connected.set(currentBus.connected);
  updateDevices();
}

// Connect to the bus
export async function connectToBus() {
  try {
    error.set(null);
    const currentBus = getBus();
    console.log('Starting Jacdac connection...');

    // cctd-ml-machine also uses WebUSB for firmware/USB flows.
    // If that controller is still connected, Jacdac cannot claim the same USB device.
    try {
      await Microbits.unlinkMicrobit();
    } catch {
      // Ignore when no linked USB micro:bit exists.
    }

    // Match Astro's known-working flow: hard reset then connect.
    await currentBus.disconnect();
    await currentBus.connect();
    console.log('Connected to Jacdac bus');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error.set(message);
    console.error('Failed to connect to Jacdac bus:', err);
  }
}

// Disconnect from the bus
export async function disconnectFromBus() {
  try {
    const currentBus = getBus();
    console.log('Starting Jacdac disconnection...');
    
    await currentBus.disconnect();
    error.set(null);
    console.log('Disconnected from Jacdac bus');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error.set(message);
    console.error('Failed to disconnect from Jacdac bus:', err);
  }
}

type TeamKey = 'A' | 'B';

type TeamControl = {
  team: TeamKey;
  rotaryService: JDService;
  buttonService: JDService;
  ledService: JDService | undefined;
  unsubscribers: (() => void)[];
  lastButtonPressed: boolean;
  lastConfirmAt: number;
  lastPosition: number | undefined;
};

export const gameSetupModuleMapping = {
  teamA: { button: 'BE25', rotary: 'VW69', led: 'UQ37' },
  teamB: { button: 'GM20', rotary: 'ZP69', led: 'PG54' },
  playButton: 'DR57',
};

export function installGameSetupJacdacController() {
  const snackbar = stores.getSnackbar();

  let detectedDevices: JDDevice[] = [];
  let teamControlBindings: TeamControl[] = [];
  let playButtonSubscriptions: (() => void)[] = [];
  let isRefreshScheduled = false;

  function cleanupControl(control: TeamControl) {
    control.unsubscribers.forEach(unsubscribe => unsubscribe());
    control.unsubscribers = [];
  }

  function cleanupAll() {
    teamControlBindings.forEach(cleanupControl);
    teamControlBindings = [];
    playButtonSubscriptions.forEach(unsubscribe => unsubscribe());
    playButtonSubscriptions = [];
  }

  function positiveModulo(value: number, modulo: number) {
    return ((value % modulo) + modulo) % modulo;
  }

  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getServicesByClass(serviceClass: number) {
    return detectedDevices.flatMap(device =>
      device.services().filter(service => service.serviceClass === serviceClass)
    );
  }

  function getServiceLabel(service: JDService) {
    return `${service.device?.friendlyName || ''} ${service.device?.name || ''} ${service.id || ''}`;
  }

  function serviceMatchesModuleCode(service: JDService, code: string) {
    return getServiceLabel(service).toUpperCase().includes(code.toUpperCase());
  }

  function pickServiceByCode(services: JDService[], code: string) {
    return services.find(service => serviceMatchesModuleCode(service, code));
  }

  function readRotaryPositionAsPaletteIndex(service: JDService) {
    if (service.serviceClass === SRV_ROTARY_ENCODER) {
      const positionRegister = service.register(RotaryEncoderReg.Position);
      return positionRegister.intValue ?? 0;
    }

    // Rotary button modules can expose potentiometer service instead of rotary encoder.
    const potRegister = service.register(PotentiometerReg.Position);
    const raw = potRegister.uintValue ?? 0;
    const ratio = Math.max(0, Math.min(1, raw / 65535));
    return Math.round(ratio * (teamColorPalette.length - 1));
  }

  async function setLedRingColor(service: JDService | undefined, hexColor: string | null) {
    if (!service || !hexColor) {
      return;
    }

    try {
      const pixelsRegister = service.register(LedReg.Pixels);
      const numPixelsRegister = service.register(LedReg.NumPixels);
      await numPixelsRegister.refresh(true);

      const pixelCount = numPixelsRegister.uintValue || 8;
      const red = Number.parseInt(hexColor.slice(1, 3), 16);
      const green = Number.parseInt(hexColor.slice(3, 5), 16);
      const blue = Number.parseInt(hexColor.slice(5, 7), 16);
      const pixels = new Uint8Array(pixelCount * 3);

      for (let index = 0; index < pixelCount; index += 1) {
        pixels[index * 3] = red;
        pixels[index * 3 + 1] = green;
        pixels[index * 3 + 2] = blue;
      }

      await pixelsRegister.sendSetPackedAsync([pixels], true);
    } catch {
      // Ignore LED updates while a device is reconnecting.
    }
  }

  async function refreshTeamLed(team: TeamKey, ledService: JDService | undefined, colorId: string | null) {
    if (!ledService || !colorId) {
      return;
    }

    const color = teamColorPalette.find(entry => entry.id === colorId) ?? null;
    await setLedRingColor(ledService, color?.hex ?? null);
  }

  async function blinkTeamLedTwice(team: TeamKey, ledService: JDService | undefined, colorId: string | null) {
    if (!ledService || !colorId) {
      return;
    }

    const color = teamColorPalette.find(entry => entry.id === colorId) ?? null;
    if (!color) {
      return;
    }

    for (let i = 0; i < 2; i += 1) {
      await setLedRingColor(ledService, color.hex);
      await delay(180);
      await setLedRingColor(ledService, '#000000');
      await delay(130);
    }

    await setLedRingColor(ledService, color.hex);
  }

  function chooseTeamColorFromEncoder(team: TeamKey, rawPosition: number, ledService: JDService | undefined) {
    const paletteSize = teamColorPalette.length;
    let nextIndex = positiveModulo(rawPosition, paletteSize);

    for (let attempts = 0; attempts < paletteSize; attempts += 1) {
      const candidateColorId = getTeamColorIdAtIndex(nextIndex);
      if (!isColorLockedForTeam(team, candidateColorId)) {
        setTeamColorByIndex(team, nextIndex);
        void refreshTeamLed(team, ledService, candidateColorId);
        return;
      }

      nextIndex = positiveModulo(nextIndex + 1, paletteSize);
    }
  }

  function handleTeamButtonPress(team: TeamKey) {
    console.log('Team confirm button pressed:', team);

    const currentlyConfirmed = team === 'A' ? get(teamAConfirmed) : get(teamBConfirmed);
    if (currentlyConfirmed) {
      setTeamColorConfirmation(team, false);
      snackbar.sendMessage(`Hold ${team}: farve låst op, vælg ny farve.`);
      return;
    }

    const didConfirm = confirmTeamColor(team);
    if (!didConfirm) {
      snackbar.sendMessage('Farven er allerede låst af det andet hold. Vælg en anden farve.');
      return;
    }

    const colorId = team === 'A' ? get(teamAColorId) : get(teamBColorId);
    const control = teamControlBindings.find(entry => entry.team === team);
    void blinkTeamLedTwice(team, control?.ledService, colorId);
  }

  function handlePlayButtonPress() {
    const deviceState = get(stores.getDevices());

    if (!deviceState.isInputAssigned || !deviceState.isOutputAssigned) {
      snackbar.sendMessage('Tilslut begge micro:bits før I kan gå videre.');
      return;
    }

    if (!get(teamAConfirmed) || !get(teamBConfirmed)) {
      snackbar.sendMessage('Begge hold skal bekræfte deres farver før spil kan starte.');
      return;
    }

    setGamePhase(GamePhase.Training);
    navigate(Paths.DATA);
  }

  function subscribeToTeamControl(
    team: TeamKey,
    rotaryService: JDService,
    buttonService: JDService,
    ledService: JDService | undefined,
  ) {
    const control: TeamControl = {
      team,
      rotaryService,
      buttonService,
      ledService,
      unsubscribers: [],
      lastButtonPressed: false,
      lastConfirmAt: 0,
      lastPosition: undefined,
    };

    const positionRegister =
      rotaryService.serviceClass === SRV_ROTARY_ENCODER
        ? rotaryService.register(RotaryEncoderReg.Position)
        : rotaryService.register(PotentiometerReg.Position);

    const unsubscribePosition = positionRegister.subscribe(CHANGE, () => {
      const rawPosition = readRotaryPositionAsPaletteIndex(rotaryService);
      if (control.lastPosition === rawPosition) {
        return;
      }

      control.lastPosition = rawPosition;
      const currentConfirmed = team === 'A' ? get(teamAConfirmed) : get(teamBConfirmed);
      if (currentConfirmed) {
        return;
      }

      chooseTeamColorFromEncoder(team, rawPosition, ledService);
    });
    control.unsubscribers.push(unsubscribePosition);

    const downEvent = buttonService.event(ButtonEvent.Down);
    if (downEvent) {
      const unsubscribeDownEvent = downEvent.subscribe(CHANGE, () => {
        const now = Date.now();
        if (now - control.lastConfirmAt < 250) {
          return;
        }

        control.lastConfirmAt = now;
        handleTeamButtonPress(team);
      });
      control.unsubscribers.push(unsubscribeDownEvent);
    }

    const buttonRegister = buttonService.register(ButtonReg.Pressed);
    const unsubscribeButton = buttonRegister.subscribe(CHANGE, () => {
      const pressed = !!buttonRegister.boolValue;
      if (pressed && !control.lastButtonPressed) {
        const now = Date.now();
        if (now - control.lastConfirmAt < 250) {
          control.lastButtonPressed = pressed;
          return;
        }

        control.lastConfirmAt = now;
        handleTeamButtonPress(team);
      }
      control.lastButtonPressed = pressed;
    });
    control.unsubscribers.push(unsubscribeButton);

    teamControlBindings.push(control);

    const initialColorId = team === 'A' ? get(teamAColorId) : get(teamBColorId);
    if (initialColorId) {
      void refreshTeamLed(team, ledService, initialColorId);
      return;
    }

    void positionRegister.refresh(true).then(() => {
      const rawPosition = readRotaryPositionAsPaletteIndex(rotaryService);
      chooseTeamColorFromEncoder(team, rawPosition, ledService);
    });
  }

  function subscribeToPlayButton(buttonService: JDService) {
    let isPressed = false;
    let lastPlayAt = 0;

    const downEvent = buttonService.event(ButtonEvent.Down);
    if (downEvent) {
      const unsubscribeDownEvent = downEvent.subscribe(CHANGE, () => {
        const now = Date.now();
        if (now - lastPlayAt < 250) {
          return;
        }

        lastPlayAt = now;
        handlePlayButtonPress();
      });
      playButtonSubscriptions.push(unsubscribeDownEvent);
    }

    const buttonRegister = buttonService.register(ButtonReg.Pressed);
    const unsubscribe = buttonRegister.subscribe(CHANGE, () => {
      const pressed = !!buttonRegister.boolValue;
      if (pressed && !isPressed) {
        const now = Date.now();
        if (now - lastPlayAt < 250) {
          isPressed = pressed;
          return;
        }

        lastPlayAt = now;
        handlePlayButtonPress();
      }
      isPressed = pressed;
    });
    playButtonSubscriptions.push(unsubscribe);
  }

  function rebuildSetupControls() {
    cleanupAll();

    if (!get(connected)) {
      return;
    }

    const rotaryServices = [
      ...getServicesByClass(SRV_ROTARY_ENCODER),
      ...getServicesByClass(SRV_POTENTIOMETER),
    ];
    const buttonServices = getServicesByClass(SRV_BUTTON);
    const ledServices = getServicesByClass(SRV_LED);

    const teamAButton = pickServiceByCode(buttonServices, gameSetupModuleMapping.teamA.button) || buttonServices[0];
    const teamARotary = pickServiceByCode(rotaryServices, gameSetupModuleMapping.teamA.rotary) || rotaryServices[0];
    const teamALed = pickServiceByCode(ledServices, gameSetupModuleMapping.teamA.led) || ledServices[0];

    const teamBButton = pickServiceByCode(buttonServices, gameSetupModuleMapping.teamB.button) || buttonServices[1];
    const teamBRotary = pickServiceByCode(rotaryServices, gameSetupModuleMapping.teamB.rotary) || rotaryServices[1];
    const teamBLed = pickServiceByCode(ledServices, gameSetupModuleMapping.teamB.led) || ledServices[1];

    if (teamARotary && teamAButton) {
      subscribeToTeamControl('A', teamARotary, teamAButton, teamALed);
    }
    if (teamBRotary && teamBButton) {
      subscribeToTeamControl('B', teamBRotary, teamBButton, teamBLed);
    }

    const playButtonService =
      pickServiceByCode(buttonServices, gameSetupModuleMapping.playButton) ||
      buttonServices.find(service => {
        return !teamControlBindings.some(control => control.buttonService.id === service.id);
      }) ||
      buttonServices[2];

    const mappedByCode = {
      teamA: {
        button: teamAButton ? getServiceLabel(teamAButton) : null,
        rotary: teamARotary ? getServiceLabel(teamARotary) : null,
        led: teamALed ? getServiceLabel(teamALed) : null,
      },
      teamB: {
        button: teamBButton ? getServiceLabel(teamBButton) : null,
        rotary: teamBRotary ? getServiceLabel(teamBRotary) : null,
        led: teamBLed ? getServiceLabel(teamBLed) : null,
      },
      playButton: playButtonService ? getServiceLabel(playButtonService) : null,
    };

    if (playButtonService) {
      subscribeToPlayButton(playButtonService);
    }

    console.log('Game setup explicit mapping:', mappedByCode);

    const fallbackPlayButton = buttonServices[2] || buttonServices.find(service => {
      return !teamControlBindings.some(control => control.buttonService.id === service.id);
    });

    console.log('Game setup mapping:', {
      rotaryCount: rotaryServices.length,
      buttonCount: buttonServices.length,
      ledCount: ledServices.length,
      teamA: teamControlBindings[0]
        ? {
            rotary:
              teamControlBindings[0].rotaryService.device?.friendlyName ||
              teamControlBindings[0].rotaryService.device?.name,
            button:
              teamControlBindings[0].buttonService.device?.friendlyName ||
              teamControlBindings[0].buttonService.device?.name,
            led:
              teamControlBindings[0].ledService?.device?.friendlyName ||
              teamControlBindings[0].ledService?.device?.name,
          }
        : null,
      teamB: teamControlBindings[1]
        ? {
            rotary:
              teamControlBindings[1].rotaryService.device?.friendlyName ||
              teamControlBindings[1].rotaryService.device?.name,
            button:
              teamControlBindings[1].buttonService.device?.friendlyName ||
              teamControlBindings[1].buttonService.device?.name,
            led:
              teamControlBindings[1].ledService?.device?.friendlyName ||
              teamControlBindings[1].ledService?.device?.name,
          }
        : null,
      playButton:
        playButtonService?.device?.friendlyName ||
        playButtonService?.device?.name ||
        fallbackPlayButton?.device?.friendlyName ||
        fallbackPlayButton?.device?.name ||
        null,
    });
  }

  function scheduleRefresh() {
    if (isRefreshScheduled) {
      return;
    }

    isRefreshScheduled = true;
    queueMicrotask(() => {
      isRefreshScheduled = false;
      rebuildSetupControls();
    });
  }

  const unsubscribeDevices = devices.subscribe(deviceList => {
    detectedDevices = [...deviceList];
    scheduleRefresh();
  });

  const unsubscribeConnected = connected.subscribe(() => {
    scheduleRefresh();
  });

  scheduleRefresh();

  return () => {
    unsubscribeDevices();
    unsubscribeConnected();
    cleanupAll();
  };
}
