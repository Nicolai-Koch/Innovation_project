<script lang="ts">
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import { ButtonEvent, ButtonReg, CHANGE, LedReg, SRV_BUTTON, SRV_LED } from 'jacdac-ts';
  import type { JDDevice, JDService } from 'jacdac-ts';
  import { connected, devices as jacdacDevices, gameSetupModuleMapping } from './stores';
  import { stores } from '../stores/Stores';
  import { requestExtraRecordingForGesture } from '../stores/ExtraRecordingStore';
  import { navigate, Paths } from '../../router/Router';
  import {
    beginTeamChallengeAttemptWindow,
    beginTeamChallengeCountdown,
    GamePhase,
    gamePhase,
    getCurrentTeamChallengeId,
    handleTeamChallengeButtonPress,
    lastFailedTeamForRetrain,
    markTeamChallengeAttemptFailed,
    requestTeamChallengeRetraining,
    setGamePhase,
    teamAChallengeState,
    teamAColorId,
    teamBChallengeState,
    teamBColorId,
    teamColorPalette,
    type TeamKey,
  } from '../stores/TeamGameStore';
  import { switchActiveTrainingTeam } from '../../pages/data/DataPage';

  const countdownMs = 3000;
  const attemptMs = 10000;
  const ledPixelCount = new Map<string, number>();
  const teamBusy = new Map<TeamKey, boolean>();

  let knownDevices: JDDevice[] = [];
  let unsubscribers: (() => void)[] = [];
  let lastTriggerAt = new Map<string, number>();

  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function cleanupSubscriptions() {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    unsubscribers = [];
  }

  function getButtonServices(): JDService[] {
    return knownDevices.flatMap(device =>
      device.services().filter((service: JDService) => service.serviceClass === SRV_BUTTON),
    );
  }

  function getLedServices(): JDService[] {
    return knownDevices.flatMap(device =>
      device.services().filter((service: JDService) => service.serviceClass === SRV_LED),
    );
  }

  function getServiceLabel(service: JDService) {
    return `${service.device?.friendlyName || ''} ${service.device?.name || ''} ${service.id || ''}`.toUpperCase();
  }

  function serviceMatchesModuleCode(service: JDService, code: string) {
    return getServiceLabel(service).includes(code.toUpperCase());
  }

  function pickServiceByCode(services: JDService[], code: string) {
    return services.find(service => serviceMatchesModuleCode(service, code));
  }

  function getPlayButtonService() {
    const buttons = getButtonServices();
    const mappedPlay = pickServiceByCode(buttons, gameSetupModuleMapping.playButton);
    if (mappedPlay) {
      return mappedPlay;
    }

    const teamAButton = pickServiceByCode(buttons, gameSetupModuleMapping.teamA.button);
    const teamBButton = pickServiceByCode(buttons, gameSetupModuleMapping.teamB.button);
    return buttons.find(service => service.id !== teamAButton?.id && service.id !== teamBButton?.id);
  }

  function getFallbackTeamButtons() {
    const playButton = getPlayButtonService();
    const candidates = getButtonServices()
      .filter(service => !playButton || service.id !== playButton.id)
      .sort((a, b) => getServiceLabel(a).localeCompare(getServiceLabel(b)));

    return {
      teamA: candidates[0],
      teamB: candidates[1],
    };
  }

  function resolveTeamFromButtonService(buttonService: JDService): TeamKey | null {
    const label = getServiceLabel(buttonService);
    if (label.includes(gameSetupModuleMapping.teamA.button.toUpperCase())) {
      return 'A';
    }
    if (label.includes(gameSetupModuleMapping.teamB.button.toUpperCase())) {
      return 'B';
    }

    const fallback = getFallbackTeamButtons();
    if (fallback.teamA && fallback.teamA.id === buttonService.id) {
      return 'A';
    }
    if (fallback.teamB && fallback.teamB.id === buttonService.id) {
      return 'B';
    }

    return null;
  }

  function resolveLedService(buttonService: JDService): JDService | undefined {
    const sameDeviceLed = buttonService.device
      ?.services()
      .find(service => service.serviceClass === SRV_LED);
    if (sameDeviceLed) {
      return sameDeviceLed;
    }

    return getLedServices()[0];
  }

  function resolveTeamLedService(team: TeamKey, buttonService: JDService): JDService | undefined {
    const leds = getLedServices();
    const teamLedCode = team === 'A' ? gameSetupModuleMapping.teamA.led : gameSetupModuleMapping.teamB.led;
    const mappedByCode = pickServiceByCode(leds, teamLedCode);
    if (mappedByCode) {
      return mappedByCode;
    }

    const sameDeviceLed = resolveLedService(buttonService);
    if (sameDeviceLed) {
      return sameDeviceLed;
    }

    return team === 'A' ? leds[0] : leds[1] || leds[0];
  }

  function getTeamColor(team: TeamKey) {
    const colorId = team === 'A' ? get(teamAColorId) : get(teamBColorId);
    const color = teamColorPalette.find(entry => entry.id === colorId);
    const hex = color?.hex ?? (team === 'A' ? '#2563eb' : '#dc2626');
    return {
      r: Number.parseInt(hex.slice(1, 3), 16),
      g: Number.parseInt(hex.slice(3, 5), 16),
      b: Number.parseInt(hex.slice(5, 7), 16),
    };
  }

  async function getLedPixelCount(service: JDService): Promise<number> {
    const cached = ledPixelCount.get(service.id);
    if (cached) {
      return cached;
    }

    const numPixelsRegister = service.register(LedReg.NumPixels);
    let pixels = 0;
    for (let i = 0; i < 8 && pixels <= 0; i++) {
      await numPixelsRegister.refresh(true);
      pixels = numPixelsRegister.uintValue ?? 0;
      if (pixels <= 0) {
        await delay(80);
      }
    }

    if (pixels > 0) {
      ledPixelCount.set(service.id, pixels);
    }
    return pixels;
  }

  async function setLedColor(service: JDService | undefined, r: number, g: number, b: number) {
    if (!service) {
      return;
    }

    const count = await getLedPixelCount(service);
    if (!count) {
      return;
    }

    const pixels = new Uint8Array(count * 3);
    for (let i = 0; i < count; i++) {
      pixels[i * 3] = r;
      pixels[i * 3 + 1] = g;
      pixels[i * 3 + 2] = b;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function setCountdownLeds(
    service: JDService | undefined,
    litCount: number,
    color: { r: number; g: number; b: number },
  ) {
    if (!service) {
      return;
    }

    const count = await getLedPixelCount(service);
    if (!count) {
      return;
    }

    const activeLeds = Math.min(count, 8);
    const safeLitCount = Math.max(0, Math.min(litCount, activeLeds));
    const pixels = new Uint8Array(count * 3);

    for (let i = 0; i < count; i++) {
      const isLit = i < safeLitCount;
      pixels[i * 3] = isLit ? color.r : 0;
      pixels[i * 3 + 1] = isLit ? color.g : 0;
      pixels[i * 3 + 2] = isLit ? color.b : 0;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function setSpinnerLed(
    service: JDService | undefined,
    activeLedIndex: number,
    color: { r: number; g: number; b: number },
  ) {
    if (!service) {
      return;
    }

    const count = await getLedPixelCount(service);
    if (!count) {
      return;
    }

    const activeLeds = Math.min(count, 8);
    const safeLedIndex = ((activeLedIndex % activeLeds) + activeLeds) % activeLeds;
    const pixels = new Uint8Array(count * 3);

    for (let i = 0; i < count; i++) {
      const isActive = i === safeLedIndex;
      pixels[i * 3] = isActive ? color.r : 0;
      pixels[i * 3 + 1] = isActive ? color.g : 0;
      pixels[i * 3 + 2] = isActive ? color.b : 0;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function blinkTeamColor(service: JDService | undefined, team: TeamKey, repeats = 3) {
    const color = getTeamColor(team);
    for (let i = 0; i < repeats; i++) {
      await setLedColor(service, color.r, color.g, color.b);
      await delay(160);
      await setLedColor(service, 0, 0, 0);
      await delay(120);
    }
    await setLedColor(service, color.r, color.g, color.b);
  }

  async function flashResultColor(service: JDService | undefined, team: TeamKey, succeeded: boolean) {
    if (succeeded) {
      await setLedColor(service, 0, 220, 90);
      await delay(550);
    } else {
      await setLedColor(service, 220, 0, 0);
      await delay(550);
    }

    const teamColor = getTeamColor(team);
    await setLedColor(service, teamColor.r, teamColor.g, teamColor.b);
  }

  async function runChallengeWindow(team: TeamKey, buttonService: JDService) {
    if (teamBusy.get(team)) {
      return;
    }

    teamBusy.set(team, true);
    const ledService = resolveTeamLedService(team, buttonService);
    const teamColor = getTeamColor(team);

    try {
      beginTeamChallengeCountdown(team, countdownMs);

      for (let litLeds = 8; litLeds > 0; litLeds--) {
        await setCountdownLeds(ledService, litLeds, teamColor);
        await delay(Math.floor(countdownMs / 8));
      }

      beginTeamChallengeAttemptWindow(team, attemptMs);

      let spinnerIndex = 0;
      const startedAt = Date.now();
      while (Date.now() - startedAt < attemptMs) {
        const state = get(team === 'A' ? teamAChallengeState : teamBChallengeState);
        if (state.status !== 'attempt') {
          break;
        }

        await setSpinnerLed(ledService, spinnerIndex, teamColor);
        spinnerIndex = (spinnerIndex + 1) % 8;
        await delay(220);
      }

      const finalState = get(team === 'A' ? teamAChallengeState : teamBChallengeState);
      if (finalState.status === 'attempt') {
        markTeamChallengeAttemptFailed(team);
      }

      const stateAfterWindow = get(team === 'A' ? teamAChallengeState : teamBChallengeState);
      await flashResultColor(ledService, team, stateAfterWindow.status === 'passed');
    } finally {
      const finalColor = getTeamColor(team);
      await setLedColor(ledService, finalColor.r, finalColor.g, finalColor.b);
      teamBusy.set(team, false);
    }
  }

  function requestExtraRecordingForCurrentChallenge(team: TeamKey) {
    const challengeId = getCurrentTeamChallengeId(team);
    if (!challengeId) {
      return;
    }

    const gesture = stores
      .getGestures()
      .getGestures()
      .find(item => item.getId() === challengeId);
    const currentTarget = gesture?.getRecordings().length ?? 0;

    requestExtraRecordingForGesture(challengeId, currentTarget + 1);
    switchActiveTrainingTeam(team);
    navigate(Paths.DATA);
  }

  function getTeamToRetrainFromPlayButton(): TeamKey | null {
    const lastFailedTeam = get(lastFailedTeamForRetrain);
    if (lastFailedTeam) {
      return lastFailedTeam;
    }

    const teamAState = get(teamAChallengeState);
    const teamBState = get(teamBChallengeState);

    if (teamAState.status === 'failed' || teamAState.status === 'awaiting-retrain') {
      return 'A';
    }

    if (teamBState.status === 'failed' || teamBState.status === 'awaiting-retrain') {
      return 'B';
    }

    return null;
  }

  function handlePlayButtonPress(buttonService: JDService) {
    const team = getTeamToRetrainFromPlayButton();
    if (!team) {
      return;
    }

    const action = requestTeamChallengeRetraining(team);
    if (action === 'request-extra-recording') {
      requestExtraRecordingForCurrentChallenge(team);
      return;
    }

    if (action === 'lower-threshold') {
      const ledService = resolveTeamLedService(team, buttonService);
      void blinkTeamColor(ledService, team, 4);
    }
  }

  function triggerWithCooldown(buttonService: JDService) {
    const playButton = getPlayButtonService();
    if (playButton && playButton.id === buttonService.id) {
      handlePlayButtonPress(buttonService);
      return;
    }

    const team = resolveTeamFromButtonService(buttonService);
    if (!team) {
      return;
    }

    const now = Date.now();
    const key = buttonService.id;
    const last = lastTriggerAt.get(key) ?? 0;
    if (now - last < 180) {
      return;
    }
    lastTriggerAt.set(key, now);

    if (get(gamePhase) !== GamePhase.Playing) {
      setGamePhase(GamePhase.Playing);
    }

    const action = handleTeamChallengeButtonPress(team);
    if (action === 'none') {
      return;
    }

    if (action === 'start-attempt') {
      void runChallengeWindow(team, buttonService);
    }
  }

  function subscribeToButtons() {
    cleanupSubscriptions();

    if (!get(connected)) {
      return;
    }

    const allButtons = getButtonServices();
    const playButton = getPlayButtonService();
    const fallbackTeams = getFallbackTeamButtons();
    const teamButtonIds = new Set(
      [
        pickServiceByCode(allButtons, gameSetupModuleMapping.teamA.button)?.id || fallbackTeams.teamA?.id,
        pickServiceByCode(allButtons, gameSetupModuleMapping.teamB.button)?.id || fallbackTeams.teamB?.id,
      ].filter((value): value is string => !!value),
    );

    const buttonServices = allButtons.filter(service => {
      if (playButton && service.id === playButton.id) {
        return true;
      }

      return teamButtonIds.has(service.id);
    });

    buttonServices.forEach(buttonService => {
      const downEvent = buttonService.event(ButtonEvent.Down);
      if (downEvent) {
        const unsubscribeEvent = downEvent.subscribe(CHANGE, () => {
          triggerWithCooldown(buttonService);
        });
        unsubscribers.push(unsubscribeEvent);
      }

      const pressedRegister = buttonService.register(ButtonReg.Pressed);
      const unsubscribeRegister = pressedRegister.subscribe(CHANGE, () => {
        if (pressedRegister.boolValue) {
          triggerWithCooldown(buttonService);
        }
      });
      unsubscribers.push(unsubscribeRegister);
    });
  }

  onMount(() => {
    const unsubscribeDevices = jacdacDevices.subscribe(deviceList => {
      knownDevices = [...deviceList];
      if (get(connected)) {
        subscribeToButtons();
      }
    });

    const unsubscribeConnected = connected.subscribe(isConnected => {
      if (isConnected) {
        subscribeToButtons();
      } else {
        cleanupSubscriptions();
      }
    });

    return () => {
      unsubscribeDevices();
      unsubscribeConnected();
      cleanupSubscriptions();
    };
  });
</script>
