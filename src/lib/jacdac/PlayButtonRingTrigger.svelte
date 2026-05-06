<script lang="ts">
  import { LedReg, SRV_BUTTON, SRV_LED } from 'jacdac-ts';
  import type { JDDevice, JDService } from 'jacdac-ts';
  import { connected, devices as jacdacDevices, gameSetupModuleMapping } from './stores';
  import { currentPath, Paths } from '../../router/Router';
  import {
    GamePhase,
    canTeamRequestRetraining,
    gamePhase,
    jacdacGameMode,
    teamATrainingComplete,
    teamBTrainingComplete,
    teamAConfirmed,
    teamBConfirmed,
    teamAChallengeState,
    teamBChallengeState,
    teamAPredictionConfidences,
    teamBPredictionConfidences,
    getCurrentTeamChallengeId,
    teamAScore,
    teamBScore,
    activeTeam,
  } from '../stores/TeamGameStore';
  import { get } from 'svelte/store';


  type RingMode = 'off' | 'spinner' | 'blink' | 'progress';

  let knownDevices: JDDevice[] = [];
  let animationToken = 0;
  let lastSignature = '';
  let lastService: JDService | undefined;

  const whiteColor = { r: 255, g: 255, b: 255 };

  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getButtonServices(): JDService[] {
    return knownDevices.flatMap(device =>
      device.services().filter(service => service.serviceClass === SRV_BUTTON),
    );
  }

  function getLedServices(): JDService[] {
    return knownDevices.flatMap(device =>
      device.services().filter(service => service.serviceClass === SRV_LED),
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

  function resolvePlayRingService() {
    const buttons = getButtonServices();
    const teamAButton = pickServiceByCode(buttons, gameSetupModuleMapping.teamA.button);
    const teamBButton = pickServiceByCode(buttons, gameSetupModuleMapping.teamB.button);
    const playButton =
      pickServiceByCode(buttons, gameSetupModuleMapping.playButton) ||
      buttons.find(service => service.id !== teamAButton?.id && service.id !== teamBButton?.id);

    const sameDeviceLed = playButton?.device
      ?.services()
      .find(service => service.serviceClass === SRV_LED);
    if (sameDeviceLed) {
      return sameDeviceLed;
    }

    const ledServices = getLedServices();
    const teamALed = pickServiceByCode(ledServices, gameSetupModuleMapping.teamA.led);
    const teamBLed = pickServiceByCode(ledServices, gameSetupModuleMapping.teamB.led);
    const reservedLedIds = new Set([teamALed?.id, teamBLed?.id].filter((value): value is string => !!value));

    return ledServices.find(service => !reservedLedIds.has(service.id));
  }

  async function getLedPixelCount(service: JDService | undefined): Promise<number> {
    if (!service) {
      return 0;
    }

    const numPixelsRegister = service.register(LedReg.NumPixels);
    let pixels = 0;

    for (let i = 0; i < 6 && pixels <= 0; i += 1) {
      await numPixelsRegister.refresh(true);
      pixels = numPixelsRegister.uintValue ?? 0;
      if (pixels <= 0) {
        await delay(60);
      }
    }

    return pixels;
  }

  function isAnimationActive(token: number) {
    return animationToken === token;
  }

  async function setLedColor(service: JDService | undefined, r: number, g: number, b: number, token: number) {
    if (!service || !isAnimationActive(token)) {
      return;
    }

    const count = await getLedPixelCount(service);
    if (!count || !isAnimationActive(token)) {
      return;
    }

    const pixels = new Uint8Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pixels[i * 3] = r;
      pixels[i * 3 + 1] = g;
      pixels[i * 3 + 2] = b;
    }

    if (!isAnimationActive(token)) {
      return;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function setSpinnerLed(service: JDService | undefined, activeLedIndex: number, token: number) {
    if (!service || !isAnimationActive(token)) {
      return;
    }

    const count = await getLedPixelCount(service);
    if (!count || !isAnimationActive(token)) {
      return;
    }

    const pixels = new Uint8Array(count * 3);
    const safeIndex = ((activeLedIndex % count) + count) % count;

    for (let i = 0; i < count; i += 1) {
      const isDark = i === safeIndex;
      pixels[i * 3] = isDark ? 0 : whiteColor.r;
      pixels[i * 3 + 1] = isDark ? 0 : whiteColor.g;
      pixels[i * 3 + 2] = isDark ? 0 : whiteColor.b;
    }

    if (!isAnimationActive(token)) {
      return;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function runSpinnerAnimation(service: JDService | undefined, token: number) {
    let activeLedIndex = 0;

    while (isAnimationActive(token)) {
      await setSpinnerLed(service, activeLedIndex, token);
      activeLedIndex = activeLedIndex + 1;
      await delay(220);
    }
  }

  async function runBlinkAnimation(service: JDService | undefined, token: number) {
    while (isAnimationActive(token)) {
      await setLedColor(service, whiteColor.r, whiteColor.g, whiteColor.b, token);
      await delay(250);
      await setLedColor(service, 0, 0, 0, token);
      await delay(220);
    }
  }

  async function setProgressPixels(service: JDService | undefined, lit: number, token: number) {
    if (!service || !isAnimationActive(token)) return;

    const count = await getLedPixelCount(service);
    if (!count || !isAnimationActive(token)) return;

    const pixels = new Uint8Array(count * 3);
    const clamped = Math.max(0, Math.min(count, lit));

    for (let i = 0; i < count; i += 1) {
      const on = i < clamped;
      pixels[i * 3] = on ? whiteColor.r : 0;
      pixels[i * 3 + 1] = on ? whiteColor.g : 0;
      pixels[i * 3 + 2] = on ? whiteColor.b : 0;
    }

    if (!isAnimationActive(token)) return;
    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function runProgressAnimation(service: JDService | undefined, token: number) {
    // Show progress towards score 65 using the ring's pixels (in order).
    // Prediction confidences are 0-1; we scale them to 0-65 for display.
    // The ring advances in 8 bands, one LED per band, and changes step by step.
    const targetScore = 65;
    let currentLit = -1;

    function getDesiredLitCount(score: number, count: number) {
      if (score <= 0) {
        return 0;
      }

      const perLed = targetScore / count;
      return Math.min(count, Math.ceil(score / perLed));
    }

    while (isAnimationActive(token)) {
      const challengeStateA = get(teamAChallengeState);
      const challengeStateB = get(teamBChallengeState);
      const team =
        challengeStateA.status === 'attempt'
          ? 'A'
          : challengeStateB.status === 'attempt'
            ? 'B'
            : (get(activeTeam) ?? 'A');
      const challengeState = team === 'A' ? challengeStateA : challengeStateB;
      const challengeId = challengeState.challengeId ?? getCurrentTeamChallengeId(team);
      if (!challengeId) {
        await delay(50);
        continue;
      }

      const confidences = team === 'A' ? get(teamAPredictionConfidences) : get(teamBPredictionConfidences);
      const confidence = confidences[challengeId] ?? 0;
      const score = Math.round(confidence * 100);

      const count = await getLedPixelCount(service);
      if (!count || !isAnimationActive(token)) return;

      const targetLit = getDesiredLitCount(score, count);

      if (targetLit !== currentLit) {
        // step towards target one LED at a time for ordered on/off
        const step = targetLit > currentLit ? 1 : -1;
        currentLit = currentLit === -1 ? 0 : currentLit;
        while (isAnimationActive(token) && currentLit !== targetLit) {
          currentLit += step;
          await setProgressPixels(service, currentLit, token);
          await delay(40);

          // If the score changed while we were stepping, adjust the target.
          const liveConfidences = team === 'A' ? get(teamAPredictionConfidences) : get(teamBPredictionConfidences);
          const liveConfidence = liveConfidences[challengeId] ?? 0;
          const liveScore = Math.round(liveConfidence * 100);
          const liveTarget = getDesiredLitCount(liveScore, count);
          if (liveTarget !== targetLit) {
            if (liveTarget === currentLit) {
              break;
            }
            if ((liveTarget > currentLit && step < 0) || (liveTarget < currentLit && step > 0)) {
              break;
            }
          }
        }
      }

      await delay(25);
    }
  }

  function getDesiredMode(
    isConnected: boolean,
    path: string,
    isGameMode: boolean,
    currentPhase: GamePhase,
    hasTeamAConfirmed: boolean,
    hasTeamBConfirmed: boolean,
    hasTeamATrainingComplete: boolean,
    hasTeamBTrainingComplete: boolean,
    teamAChallengeStatus: string,
    teamBChallengeStatus: string,
  ): RingMode {
    if (!isConnected) {
      return 'off';
    }

    if (
      isGameMode &&
      ((teamAChallengeStatus === 'failed' && canTeamRequestRetraining('A')) ||
        (teamBChallengeStatus === 'failed' && canTeamRequestRetraining('B')))
    ) {
      return 'blink';
    }

    // If a team is currently attempting a challenge, show progress on the ring
    if (isGameMode && (teamAChallengeStatus === 'attempt' || teamBChallengeStatus === 'attempt')) {
      return 'progress';
    }

    if (
      isGameMode &&
      path !== Paths.MODEL &&
      hasTeamATrainingComplete &&
      hasTeamBTrainingComplete
    ) {
      return 'spinner';
    }

    if (isGameMode && path !== Paths.MODEL && currentPhase === GamePhase.Setup && hasTeamAConfirmed && hasTeamBConfirmed) {
      return 'spinner';
    }

    return 'off';
  }

  function refreshRingState(
    isConnected: boolean,
    path: string,
    isGameMode: boolean,
    currentPhase: GamePhase,
    hasTeamAConfirmed: boolean,
    hasTeamBConfirmed: boolean,
    hasTeamATrainingComplete: boolean,
    hasTeamBTrainingComplete: boolean,
    teamAChallengeStatus: string,
    teamBChallengeStatus: string,
  ) {
    knownDevices = [...$jacdacDevices];
    const service = resolvePlayRingService();
    const mode = service
      ? getDesiredMode(
          isConnected,
          path,
          isGameMode,
          currentPhase,
          hasTeamAConfirmed,
          hasTeamBConfirmed,
          hasTeamATrainingComplete,
          hasTeamBTrainingComplete,
          teamAChallengeStatus,
          teamBChallengeStatus,
        )
      : 'off';
    const signature = `${service?.id ?? 'none'}:${mode}`;

    if (signature === lastSignature) {
      return;
    }

    const previousSignature = lastSignature;
    lastSignature = signature;
    const previousService = lastService;
    lastService = service;
    animationToken += 1;
    const token = animationToken;

    if (previousService && previousService.id !== service?.id) {
      void setLedColor(previousService, 0, 0, 0, token);
    }

    if (mode === 'off') {
      if (previousSignature !== signature) {
        void setLedColor(previousService ?? service, 0, 0, 0, token);
      }
      return;
    }

    if (mode === 'spinner') {
      void runSpinnerAnimation(service, token);
      return;
    }

    if (mode === 'progress') {
      void runProgressAnimation(service, token);
      return;
    }

    void runBlinkAnimation(service, token);
  }

  $: refreshRingState(
    $connected,
    $currentPath,
    $jacdacGameMode,
    $gamePhase,
    $teamAConfirmed,
    $teamBConfirmed,
    $teamATrainingComplete,
    $teamBTrainingComplete,
    $teamAChallengeState.status,
    $teamBChallengeState.status,
  );
</script>