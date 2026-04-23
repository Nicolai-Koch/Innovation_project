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
    canTeamRequestRetraining,
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
  const triggerCooldownMs = 450;
  const ledPixelCount = new Map<string, number>();
  const teamBusy = new Map<TeamKey, boolean>();
  const buttonPressedState = new Map<string, boolean>();
  const buttonRoleByServiceId = new Map<string, TeamKey | 'PLAY'>();
  const ledServiceByTeam = new Map<TeamKey, JDService>();
  const ledAnimationTokenByService = new Map<string, number>();

  let knownDevices: JDDevice[] = [];
  let unsubscribers: (() => void)[] = [];
  let lastTriggerAt = new Map<string, number>();
  let retrainNavigationInProgress = false;

  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function playFailedChallengeSound() {
    try {
      const sound = new Audio('sounds/Ikke%20korrekt%20udført%20klasse.m4a');
      void sound.play().catch(() => undefined);
    } catch {
      // Ignore playback errors in browsers or environments without audio support.
    }
  }

  function cleanupSubscriptions() {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    unsubscribers = [];
    buttonPressedState.clear();
    buttonRoleByServiceId.clear();
    ledServiceByTeam.clear();
    ledAnimationTokenByService.clear();
    retrainNavigationInProgress = false;
  }

  function beginLedAnimation(service: JDService | undefined) {
    if (!service) {
      return 0;
    }

    const nextToken = (ledAnimationTokenByService.get(service.id) ?? 0) + 1;
    ledAnimationTokenByService.set(service.id, nextToken);
    return nextToken;
  }

  function hasActiveLedAnimationToken(service: JDService | undefined, token?: number) {
    if (!service || token === undefined) {
      return true;
    }

    return ledAnimationTokenByService.get(service.id) === token;
  }

  function buildTeamLedMap() {
    ledServiceByTeam.clear();
    const leds = getLedServices();

    const mappedTeamA = pickServiceByCode(leds, gameSetupModuleMapping.teamA.led);
    const mappedTeamB = pickServiceByCode(leds, gameSetupModuleMapping.teamB.led);

    const assignedIds = new Set<string>();
    const assignLed = (team: TeamKey, service: JDService | undefined) => {
      if (!service || assignedIds.has(service.id)) {
        return;
      }

      ledServiceByTeam.set(team, service);
      assignedIds.add(service.id);
    };

    assignLed('A', mappedTeamA);
    assignLed('B', mappedTeamB);

    const remaining = leds.filter(service => !assignedIds.has(service.id));
    if (!ledServiceByTeam.get('A')) {
      assignLed('A', remaining[0]);
    }
    if (!ledServiceByTeam.get('B')) {
      const next = remaining.find(service => !assignedIds.has(service.id));
      assignLed('B', next);
    }

    // If only one ring is available, both teams can share as a final fallback.
    if (!ledServiceByTeam.get('A') && ledServiceByTeam.get('B')) {
      ledServiceByTeam.set('A', ledServiceByTeam.get('B') as JDService);
    }
    if (!ledServiceByTeam.get('B') && ledServiceByTeam.get('A')) {
      ledServiceByTeam.set('B', ledServiceByTeam.get('A') as JDService);
    }
  }

  function buildButtonRoleMap(buttons: JDService[]) {
    buttonRoleByServiceId.clear();

    const mappedTeamA = pickServiceByCode(buttons, gameSetupModuleMapping.teamA.button);
    const mappedTeamB = pickServiceByCode(buttons, gameSetupModuleMapping.teamB.button);
    const mappedPlay = pickServiceByCode(buttons, gameSetupModuleMapping.playButton)
      || buttons.find(service => service.id !== mappedTeamA?.id && service.id !== mappedTeamB?.id);

    const assignedIds = new Set<string>();
    const assignRole = (service: JDService | undefined, role: TeamKey | 'PLAY') => {
      if (!service || assignedIds.has(service.id)) {
        return;
      }

      buttonRoleByServiceId.set(service.id, role);
      assignedIds.add(service.id);
    };

    assignRole(mappedPlay, 'PLAY');
    assignRole(mappedTeamA, 'A');
    assignRole(mappedTeamB, 'B');

    const unassigned = buttons
      .filter(service => !assignedIds.has(service.id))
      .sort((a, b) => getServiceLabel(a).localeCompare(getServiceLabel(b)));

    if (![...buttonRoleByServiceId.values()].includes('A')) {
      assignRole(unassigned[0], 'A');
    }
    if (![...buttonRoleByServiceId.values()].includes('B')) {
      const remaining = unassigned.find(service => !assignedIds.has(service.id));
      assignRole(remaining, 'B');
    }
    if (![...buttonRoleByServiceId.values()].includes('PLAY')) {
      const remaining = unassigned.find(service => !assignedIds.has(service.id));
      assignRole(remaining, 'PLAY');
    }
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
    const mapped = ledServiceByTeam.get(team);
    if (mapped) {
      return mapped;
    }

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

  async function setLedColor(service: JDService | undefined, r: number, g: number, b: number, token?: number) {
    if (!service) {
      return;
    }

    if (!hasActiveLedAnimationToken(service, token)) {
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

    if (!hasActiveLedAnimationToken(service, token)) {
      return;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function setCountdownLeds(
    service: JDService | undefined,
    litCount: number,
    color: { r: number; g: number; b: number },
    token?: number,
  ) {
    if (!service) {
      return;
    }

    if (!hasActiveLedAnimationToken(service, token)) {
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

    if (!hasActiveLedAnimationToken(service, token)) {
      return;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function setSpinnerLed(
    service: JDService | undefined,
    activeLedIndex: number,
    color: { r: number; g: number; b: number },
    token?: number,
  ) {
    if (!service) {
      return;
    }

    if (!hasActiveLedAnimationToken(service, token)) {
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

    if (!hasActiveLedAnimationToken(service, token)) {
      return;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function blinkTeamColor(service: JDService | undefined, team: TeamKey, repeats = 3, token?: number) {
    const color = getTeamColor(team);
    for (let i = 0; i < repeats; i++) {
      await setLedColor(service, color.r, color.g, color.b, token);
      await delay(160);
      await setLedColor(service, 0, 0, 0, token);
      await delay(120);
    }
    await setLedColor(service, color.r, color.g, color.b, token);
  }

  async function flashResultColor(service: JDService | undefined, team: TeamKey, succeeded: boolean, token?: number) {
    if (succeeded) {
      for (let i = 0; i < 10; i++) {
        await setLedColor(service, 0, 220, 90, token);
        await delay(250);
        await setLedColor(service, 0, 0, 0, token);
        await delay(250);
      }
    } else {
      for (let i = 0; i < 10; i++) {
        await setLedColor(service, 220, 0, 0, token);
        await delay(250);
        await setLedColor(service, 0, 0, 0, token);
        await delay(250);
      }
    }

    const teamColor = getTeamColor(team);
    await setLedColor(service, teamColor.r, teamColor.g, teamColor.b, token);
  }

  async function runChallengeWindow(team: TeamKey, buttonService: JDService) {
    if (teamBusy.get(team)) {
      return;
    }

    teamBusy.set(team, true);
    const ledService = resolveTeamLedService(team, buttonService);
    const teamColor = getTeamColor(team);
    const animationToken = beginLedAnimation(ledService);

    try {
      beginTeamChallengeCountdown(team, countdownMs);
      await setLedColor(ledService, 0, 0, 0, animationToken);

      for (let litLeds = 8; litLeds > 0; litLeds--) {
        await setCountdownLeds(ledService, litLeds, teamColor, animationToken);
        await delay(Math.floor(countdownMs / 8));
      }
      await setCountdownLeds(ledService, 0, teamColor, animationToken);

      beginTeamChallengeAttemptWindow(team, attemptMs);

      let spinnerIndex = 0;
      const startedAt = Date.now();
      while (Date.now() - startedAt < attemptMs) {
        const state = get(team === 'A' ? teamAChallengeState : teamBChallengeState);
        if (state.status !== 'attempt') {
          break;
        }

        await setSpinnerLed(ledService, spinnerIndex, teamColor, animationToken);
        spinnerIndex = (spinnerIndex + 1) % 8;
        await delay(220);
      }

      const finalState = get(team === 'A' ? teamAChallengeState : teamBChallengeState);
      if (finalState.status === 'attempt') {
        markTeamChallengeAttemptFailed(team);
        playFailedChallengeSound();
      }

      const stateAfterWindow = get(team === 'A' ? teamAChallengeState : teamBChallengeState);
      await flashResultColor(ledService, team, stateAfterWindow.status === 'passed', animationToken);
    } finally {
      teamBusy.set(team, false);
      const finalColor = getTeamColor(team);
      try {
        await setLedColor(ledService, finalColor.r, finalColor.g, finalColor.b, animationToken);
      } catch {
        // Ignore final LED restore failures so gameplay state is never blocked.
      }
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
    const trainingTeam: TeamKey = challengeId <= 3 ? 'A' : 'B';

    switchActiveTrainingTeam(trainingTeam);
    requestExtraRecordingForGesture(challengeId, currentTarget + 1);
    navigate(Paths.DATA);
  }

  function getTeamToRetrainFromPlayButton(): TeamKey | null {
    const lastFailedTeam = get(lastFailedTeamForRetrain);
    if (lastFailedTeam && canTeamRequestRetraining(lastFailedTeam)) {
      return lastFailedTeam;
    }

    const teamAState = get(teamAChallengeState);
    const teamBState = get(teamBChallengeState);

    if ((teamAState.status === 'failed' || teamAState.status === 'awaiting-retrain') && canTeamRequestRetraining('A')) {
      return 'A';
    }

    if ((teamBState.status === 'failed' || teamBState.status === 'awaiting-retrain') && canTeamRequestRetraining('B')) {
      return 'B';
    }

    return null;
  }

  function isAnyChallengeAnimationRunning() {
    return !!teamBusy.get('A') || !!teamBusy.get('B');
  }

  function handlePlayButtonPress(buttonService: JDService) {
    if (isAnyChallengeAnimationRunning()) {
      return false;
    }

    if (retrainNavigationInProgress) {
      return false;
    }

    const team = getTeamToRetrainFromPlayButton();
    if (!team) {
      return false;
    }

    const action = requestTeamChallengeRetraining(team);
    if (action === 'request-extra-recording') {
      retrainNavigationInProgress = true;
      const ledService = resolveTeamLedService(team, buttonService);
      const animationToken = beginLedAnimation(ledService);
      // Show waiting animation on the team's LED while navigating to retrain
      void blinkTeamColor(ledService, team, 2, animationToken);
      requestExtraRecordingForCurrentChallenge(team);
      return true;
    }

    return false;
  }

  function triggerWithCooldown(buttonService: JDService) {
    const mappedRole = buttonRoleByServiceId.get(buttonService.id);
    const team = mappedRole === 'A' || mappedRole === 'B' ? mappedRole : resolveTeamFromButtonService(buttonService);
    const isPlayButton = mappedRole === 'PLAY';
    const cooldownKey = isPlayButton ? 'PLAY' : team;

    if (!cooldownKey) {
      return;
    }

    const now = Date.now();
    const last = lastTriggerAt.get(cooldownKey) ?? 0;
    if (now - last < triggerCooldownMs) {
      return;
    }

    if (isPlayButton) {
      const handled = handlePlayButtonPress(buttonService);
      if (handled) {
        lastTriggerAt.set(cooldownKey, now);
      }
      return;
    }

    if (!team) {
      return;
    }

    if (get(gamePhase) !== GamePhase.Playing) {
      setGamePhase(GamePhase.Playing);
    }

    const action = handleTeamChallengeButtonPress(team);
    if (action === 'none') {
      return;
    }

    if (action === 'start-attempt') {
      lastTriggerAt.set(cooldownKey, now);
      void runChallengeWindow(team, buttonService);
    }
  }

  function subscribeToButtons() {
    cleanupSubscriptions();
    teamBusy.clear();
    lastTriggerAt.clear();
    buttonPressedState.clear();
    retrainNavigationInProgress = false;
    ledAnimationTokenByService.clear();

    if (!get(connected)) {
      return;
    }

    const allButtons = getButtonServices();
    buildButtonRoleMap(allButtons);
    buildTeamLedMap();
    const buttonServices = allButtons.filter(service => buttonRoleByServiceId.has(service.id));

    buttonServices.forEach(buttonService => {
      const downEvent = buttonService.event(ButtonEvent.Down);
      if (downEvent) {
        const unsubscribeEvent = downEvent.subscribe(CHANGE, () => {
          triggerWithCooldown(buttonService);
        });
        unsubscribers.push(unsubscribeEvent);
      }

      if (buttonRoleByServiceId.get(buttonService.id) !== 'PLAY') {
        const pressedRegister = buttonService.register(ButtonReg.Pressed);
        const unsubscribeRegister = pressedRegister.subscribe(CHANGE, () => {
          const isPressed = !!pressedRegister.boolValue;
          const wasPressed = buttonPressedState.get(buttonService.id) ?? false;
          buttonPressedState.set(buttonService.id, isPressed);

          if (isPressed && !wasPressed) {
            triggerWithCooldown(buttonService);
          }
        });
        unsubscribers.push(unsubscribeRegister);
      }
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
