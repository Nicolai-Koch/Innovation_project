<script lang="ts">
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import {
    ButtonEvent,
    ButtonReg,
    CHANGE,
    LedReg,
    SRV_BUTTON,
    SRV_LED,
  } from 'jacdac-ts';
  import type { JDDevice, JDService } from 'jacdac-ts';
  import { connected, devices as jacdacDevices, gameSetupModuleMapping } from './stores';
  import StaticConfiguration from '../../StaticConfiguration';
  import { stores } from '../stores/Stores';
  import { chosenGesture, alertUser } from '../stores/uiStore';
  import {
    clearRequestedExtraRecording,
    requestedExtraRecordingRequest,
  } from '../stores/ExtraRecordingStore';
  import { Feature, getFeature } from '../FeatureToggles';
  import { startRecording } from '../utils/Recording';
  import { navigate, Paths } from '../../router/Router';
  import { trainBothTeamModels, trainKNNModel, trainNNModel } from '../../pages/training/TrainingPage.ts';
  import ModelRegistry from '../domain/ModelRegistry';
  import { modelTrainingInProgress } from '../stores/ApplicationState';
  import {
    activeTeam,
    classesPerRound,
    GamePhase,
    jacdacGameMode,
    setGamePhase,
    teamAColorId,
    teamATrainingComplete,
    teamBColorId,
    teamBTrainingComplete,
    teamColorPalette,
    type TeamKey,
  } from '../stores/TeamGameStore';
  import {
    getStoredTeamDatasetSnapshot,
    switchActiveTrainingTeam,
  } from '../../pages/data/DataPage';

  let knownDevices: JDDevice[] = [];
  let triggerInProgress = false;
  let unsubscribers: (() => void)[] = [];
  let lastTriggerAt = new Map<string, number>();
  const ledPixelCount = new Map<string, number>();
  let waitingAnimationTimeout: ReturnType<typeof setTimeout> | undefined;
  let waitingAnimationFrame = 0;
  let waitingAnimationInFlight = false;

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function cleanupSubscriptions() {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribers = [];
  }

  function getButtonServices(): JDService[] {
    return knownDevices.flatMap((device) =>
      device.services().filter((service: JDService) => service.serviceClass === SRV_BUTTON)
    );
  }

  function getLedServices(): JDService[] {
    return knownDevices.flatMap((device) =>
      device.services().filter((service: JDService) => service.serviceClass === SRV_LED)
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
    return buttons.find(
      service => service.id !== teamAButton?.id && service.id !== teamBButton?.id,
    );
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

  function getNextGestureToRecord() {
    return stores
      .getGestures()
      .getGestures()
      .find(gesture => gesture.getRecordings().length < StaticConfiguration.minNoOfRecordingsPerGesture);
  }

  function getIncompleteGestures() {
    return stores
      .getGestures()
      .getGestures()
      .filter(gesture => gesture.getRecordings().length < StaticConfiguration.minNoOfRecordingsPerGesture);
  }

  function hasIncompleteGestures() {
    return getIncompleteGestures().length > 0;
  }

  function getRequestedExtraRecordingContext() {
    const request = get(requestedExtraRecordingRequest);
    if (!request) return null;

    const gesture = stores
      .getGestures()
      .getGestures()
      .find(item => item.getId() === request.gestureId);

    if (!gesture) {
      clearRequestedExtraRecording();
      return null;
    }

    if (gesture.getRecordings().length >= request.targetRecordings) {
      clearRequestedExtraRecording();
      return null;
    }

    return {
      gesture,
      targetRecordings: request.targetRecordings,
    };
  }

  function hasEnoughDataToTrain() {
    const gestures = stores.getGestures().getGestures();
    const requiredGestureCount = $jacdacGameMode
      ? $classesPerRound
      : StaticConfiguration.minNoOfGestures;
    return (
      gestures.length >= requiredGestureCount &&
      gestures.every(
        gesture =>
          gesture.getRecordings().length >= StaticConfiguration.minNoOfRecordingsPerGesture,
      )
    );
  }

  function hasEnoughDataForCurrentTeam() {
    const gestures = stores.getGestures().getGestures();
    if (gestures.length < $classesPerRound) {
      return false;
    }

    return gestures.every(
      gesture => gesture.getRecordings().length >= StaticConfiguration.minNoOfRecordingsPerGesture,
    );
  }

  async function getLedPixelCount(service: JDService): Promise<number> {
    const cached = ledPixelCount.get(service.id);
    if (cached) return cached;

    const numPixelsRegister = service.register(LedReg.NumPixels);
    let pixels = 0;
    for (let i = 0; i < 8 && pixels <= 0; i++) {
      await numPixelsRegister.refresh(true);
      pixels = numPixelsRegister.uintValue ?? 0;
      if (pixels <= 0) await delay(80);
    }

    if (pixels > 0) ledPixelCount.set(service.id, pixels);
    return pixels;
  }

  async function setLedColor(service: JDService | undefined, r: number, g: number, b: number) {
    if (!service) return;

    const count = await getLedPixelCount(service);
    if (!count) return;

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
    if (!service) return;

    const count = await getLedPixelCount(service);
    if (!count) return;

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

  async function setProgressLeds(service: JDService | undefined, activeLedIndex: number) {
    if (!service) return;

    const count = await getLedPixelCount(service);
    if (!count) return;

    const activeLeds = Math.min(count, 8);
    const safeLedIndex = ((activeLedIndex % activeLeds) + activeLeds) % activeLeds;
    const pixels = new Uint8Array(count * 3);

    for (let i = 0; i < count; i++) {
      const isLit = i === safeLedIndex;
      pixels[i * 3] = isLit ? 0 : 0;
      pixels[i * 3 + 1] = isLit ? 180 : 0;
      pixels[i * 3 + 2] = isLit ? 255 : 0;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  function resolveLedService(buttonService: JDService): JDService | undefined {
    const sameDeviceLed = buttonService.device
      ?.services()
      .find((service) => service.serviceClass === SRV_LED);
    if (sameDeviceLed) return sameDeviceLed;

    return getLedServices()[0];
  }

  function resolveTeamLedService(team: TeamKey, buttonService: JDService): JDService | undefined {
    const leds = getLedServices();
    const teamLedCode = team === 'A' ? gameSetupModuleMapping.teamA.led : gameSetupModuleMapping.teamB.led;
    const mappedByCode = pickServiceByCode(leds, teamLedCode);
    if (mappedByCode) return mappedByCode;

    const sameDeviceLed = resolveLedService(buttonService);
    if (sameDeviceLed) return sameDeviceLed;

    return team === 'A' ? leds[0] : leds[1] || leds[0];
  }

  function resolveMappedTeamLedService(team: TeamKey): JDService | undefined {
    const leds = getLedServices();
    const teamLedCode = team === 'A' ? gameSetupModuleMapping.teamA.led : gameSetupModuleMapping.teamB.led;
    const mappedByCode = pickServiceByCode(leds, teamLedCode);
    if (mappedByCode) return mappedByCode;

    return team === 'A' ? leds[0] : leds[1] || leds[0];
  }

  async function setSingleSpinnerLed(
    service: JDService | undefined,
    activeLedIndex: number,
    color: { r: number; g: number; b: number },
  ) {
    if (!service) return;

    const count = await getLedPixelCount(service);
    if (!count) return;

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

  async function setWaitingRingLeds(
    service: JDService | undefined,
    darkLedIndex: number,
    color: { r: number; g: number; b: number },
  ) {
    if (!service) return;

    const count = await getLedPixelCount(service);
    if (!count) return;

    const activeLeds = Math.min(count, 8);
    const safeDarkIndex = ((darkLedIndex % activeLeds) + activeLeds) % activeLeds;
    const pixels = new Uint8Array(count * 3);

    for (let i = 0; i < count; i++) {
      const isDark = i === safeDarkIndex;
      pixels[i * 3] = isDark ? 0 : color.r;
      pixels[i * 3 + 1] = isDark ? 0 : color.g;
      pixels[i * 3 + 2] = isDark ? 0 : color.b;
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function blinkTeamColorTwice(
    service: JDService | undefined,
    color: { r: number; g: number; b: number },
  ) {
    for (let i = 0; i < 2; i++) {
      await setLedColor(service, color.r, color.g, color.b);
      await delay(180);
      await setLedColor(service, 0, 0, 0);
      await delay(130);
    }
    await setLedColor(service, color.r, color.g, color.b);
  }

  async function trainBothTeamsWithLedAnimation() {
    const ledA = resolveMappedTeamLedService('A');
    const ledB = resolveMappedTeamLedService('B');
    const colorA = getTeamCountdownColor('A');
    const colorB = getTeamCountdownColor('B');

    const trainingPromise = trainBothTeamModels();
    let trainingDone = false;

    void trainingPromise.finally(() => {
      trainingDone = true;
    });

    let activeLedIndex = 0;
    while (!trainingDone) {
      await Promise.all([
        setSingleSpinnerLed(ledA, activeLedIndex, colorA),
        setSingleSpinnerLed(ledB, activeLedIndex, colorB),
      ]);
      activeLedIndex = (activeLedIndex + 1) % 8;
      await delay(220);
    }

    await trainingPromise;

    await Promise.all([
      setLedColor(ledA, colorA.r, colorA.g, colorA.b),
      setLedColor(ledB, colorB.r, colorB.g, colorB.b),
    ]);
  }

  function getTeamCountdownColor(team: TeamKey) {
    const colorId = team === 'A' ? $teamAColorId : $teamBColorId;
    const color = teamColorPalette.find(entry => entry.id === colorId);
    const hex = color?.hex ?? (team === 'A' ? '#2563eb' : '#dc2626');
    return {
      r: Number.parseInt(hex.slice(1, 3), 16),
      g: Number.parseInt(hex.slice(3, 5), 16),
      b: Number.parseInt(hex.slice(5, 7), 16),
    };
  }

  function hasPendingRecordings() {
    if (!$jacdacGameMode) {
      return !hasEnoughDataToTrain();
    }

    return teamNeedsMoreRecordings('A') || teamNeedsMoreRecordings('B');
  }

  function teamNeedsMoreRecordings(team: TeamKey) {
    if (!$jacdacGameMode) {
      return !hasEnoughDataToTrain();
    }

    const snapshot = getStoredTeamDatasetSnapshot(team);
    if (!snapshot || snapshot.length === 0) {
      return true;
    }

    return snapshot.some(
      gesture =>
        gesture.recordings.length < StaticConfiguration.minNoOfRecordingsPerGesture,
    );
  }

  async function runTrainingWaitingAnimationFrame() {
    if (waitingAnimationInFlight) return;
    waitingAnimationInFlight = true;

    try {
      if (!get(connected) || triggerInProgress || $modelTrainingInProgress) {
        return;
      }

      if (!hasPendingRecordings()) {
        const colorA = getTeamCountdownColor('A');
        const colorB = getTeamCountdownColor('B');
        await Promise.all([
          setLedColor(resolveMappedTeamLedService('A'), colorA.r, colorA.g, colorA.b),
          setLedColor(resolveMappedTeamLedService('B'), colorB.r, colorB.g, colorB.b),
        ]);
        return;
      }

      const ledA = resolveMappedTeamLedService('A');
      const ledB = resolveMappedTeamLedService('B');
      const colorA = getTeamCountdownColor('A');
      const colorB = getTeamCountdownColor('B');

      const teamANeedsMore = teamNeedsMoreRecordings('A');
      const teamBNeedsMore = teamNeedsMoreRecordings('B');

      await Promise.all([
        teamANeedsMore
          ? setWaitingRingLeds(ledA, waitingAnimationFrame, colorA)
          : setLedColor(ledA, colorA.r, colorA.g, colorA.b),
        teamBNeedsMore
          ? setWaitingRingLeds(ledB, waitingAnimationFrame, colorB)
          : setLedColor(ledB, colorB.r, colorB.g, colorB.b),
      ]);

      waitingAnimationFrame = (waitingAnimationFrame + 1) % 8;
    } finally {
      waitingAnimationInFlight = false;
    }
  }

  function startTrainingWaitingAnimation() {
    if (waitingAnimationTimeout) {
      return;
    }

    const tick = async () => {
      await runTrainingWaitingAnimationFrame();
      waitingAnimationTimeout = setTimeout(() => {
        void tick();
      }, 220);
    };

    void tick();
  }

  function stopTrainingWaitingAnimation() {
    if (waitingAnimationTimeout) {
      clearTimeout(waitingAnimationTimeout);
      waitingAnimationTimeout = undefined;
    }
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

  function isPlayButtonService(buttonService: JDService) {
    const play = getPlayButtonService();
    if (!play) {
      return false;
    }
    return play.id === buttonService.id;
  }

  function handlePlayButtonPress(buttonService: JDService) {
    const requestedContext = getRequestedExtraRecordingContext();
    
    // If we're in retrain mode (extra recording requested), trigger recording
    if (requestedContext) {
      void runLedAndRecord(buttonService, $activeTeam);
      return;
    }

    if (!$jacdacGameMode) {
      return;
    }

    if (!$teamATrainingComplete || !$teamBTrainingComplete) {
      alertUser('Begge hold skal være helt færdige med træning, før I kan starte spillet.');
      return;
    }

    void (async () => {
      await trainBothTeamsWithLedAnimation();
      navigate(Paths.MODEL);
    })();
  }

  function triggerDataRecording() {
    const requestedContext = getRequestedExtraRecordingContext();
    const gesture = requestedContext?.gesture ?? getNextGestureToRecord();
    if (!gesture) return false;

    chosenGesture.set(gesture);
    startRecording(recording => {
      gesture.addRecording(recording);
      if (
        requestedContext &&
        requestedContext.gesture.getId() === gesture.getId() &&
        gesture.getRecordings().length >= requestedContext.targetRecordings
      ) {
        clearRequestedExtraRecording();
      }
      const next = getNextGestureToRecord();
      chosenGesture.set(next ?? gesture);
    });

    return true;
  }

  async function trainModelFromDataPage(ledService: JDService | undefined) {
    if ($modelTrainingInProgress) return;

    modelTrainingInProgress.set(true);
    navigate(Paths.TRAINING);
    const ledStepDelayMs = 280;

    try {
      const trainingPromise = get(stores.getSelectedModel()).id === ModelRegistry.KNN.id
        ? trainKNNModel()
        : trainNNModel();
      let trainingDone = false;

      void trainingPromise.finally(() => {
        trainingDone = true;
      });

      let activeLedIndex = 0;

      while (!trainingDone) {
        await setProgressLeds(ledService, activeLedIndex);
        activeLedIndex = (activeLedIndex + 1) % 8;
        await delay(ledStepDelayMs);
      }

      await trainingPromise;
      await setLedColor(ledService, 0, 0, 0);
      navigate(Paths.MODEL);
    } catch (e) {
      console.error('Jacdac model training failed:', e);
      await setLedColor(ledService, 255, 0, 0);
      await delay(1000);
      await setLedColor(ledService, 0, 0, 0);
    } finally {
      modelTrainingInProgress.set(false);
    }
  }

  async function runLedAndRecord(buttonService: JDService, team: TeamKey) {
    if ($modelTrainingInProgress) return;

    const requestedExtraContext = getRequestedExtraRecordingContext();
    const recordingTargetGesture = requestedExtraContext?.gesture ?? getNextGestureToRecord();
    const recordingTargetGestureId = recordingTargetGesture?.getId();
    const recordingCountBefore = recordingTargetGesture?.getRecordings().length ?? 0;
    const hasRecordingTarget = !!getNextGestureToRecord();
    const ledService = resolveTeamLedService(team, buttonService);
    const countdownColor = getTeamCountdownColor(team);
    let recordingWasSuccessful = false;
    const isRetrainMode = !!requestedExtraContext;

    if (!requestedExtraContext && hasEnoughDataToTrain()) {
      if ($jacdacGameMode) {
        alertUser(`Hold ${team} kan ikke optage mere. Alle klasser er allerede fyldt.`);
        return;
      }
      await trainModelFromDataPage(ledService);
      return;
    }

    // If all current classes are filled and we do not yet have enough data to train,
    // do nothing until the user adds a new class.
    if (!hasRecordingTarget && !requestedExtraContext) {
      if ($jacdacGameMode) {
        alertUser(`Hold ${team} kan ikke optage mere. Alle klasser er allerede fyldt.`);
      }
      return;
    }

    // Check if there are multiple incomplete gestures - user should finish the previous one
    const incompleteGestures = getIncompleteGestures();
    if (!$jacdacGameMode && incompleteGestures.length > 1) {
      const firstIncompleteGesture = incompleteGestures[0];
      const recordingsCount = firstIncompleteGesture.getRecordings().length;
      const recordingsNeeded = StaticConfiguration.minNoOfRecordingsPerGesture - recordingsCount;
      alertUser(
        `Færdiggør først "${firstIncompleteGesture.getName()}" bevægelse (${recordingsNeeded} flere optagelser) før du kan optage til en ny klasse.`
      );
      return;
    }

    if (triggerInProgress) return;
    triggerInProgress = true;

    const recordingDuration = getFeature<number>(Feature.RECORDING_DURATION);
    const countdownDuration = 3000;

    try {
      // Show a full white ring and turn off one LED at a time over 7 seconds.
      for (let litLeds = 8; litLeds > 0; litLeds--) {
        await setCountdownLeds(ledService, litLeds, countdownColor);
        await delay(Math.floor(countdownDuration / 8));
      }

      await setCountdownLeds(ledService, 0, countdownColor);
      await setLedColor(ledService, 0, 255, 0);

      const didStartRecording = triggerDataRecording();
      if (!didStartRecording) {
        await setLedColor(ledService, 255, 180, 0);
        await delay(800);
        await setLedColor(ledService, 0, 0, 0);
        return;
      }

      await delay(recordingDuration + 80);

      await setLedColor(ledService, 255, 0, 0);
      await delay(650);
      await setLedColor(ledService, countdownColor.r, countdownColor.g, countdownColor.b);
      recordingWasSuccessful = true;

      if (recordingTargetGestureId !== undefined) {
        const updatedGesture = stores
          .getGestures()
          .getGestures()
          .find(gesture => gesture.getId() === recordingTargetGestureId);
        const recordingCountAfter = updatedGesture?.getRecordings().length ?? recordingCountBefore;
        const minRequired = StaticConfiguration.minNoOfRecordingsPerGesture;

        if (recordingCountBefore < minRequired && recordingCountAfter >= minRequired) {
          await blinkTeamColorTwice(ledService, countdownColor);
        }
      }

      if ($jacdacGameMode && hasEnoughDataForCurrentTeam()) {
        if (team === 'A') {
          teamATrainingComplete.set(true);
        } else {
          teamBTrainingComplete.set(true);
        }
      }

      // Auto-trigger retrain training if we just completed extra recording
      if (isRetrainMode && recordingWasSuccessful) {
        clearRequestedExtraRecording();
        void (async () => {
          await trainBothTeamsWithLedAnimation();
          navigate(Paths.MODEL);
        })();
      }
    } catch (e) {
      console.error('Jacdac data trigger failed:', e);
    } finally {
      triggerInProgress = false;
    }
  }

  function triggerWithCooldown(buttonService: JDService) {
    if (triggerInProgress) return;

    if (isPlayButtonService(buttonService)) {
      handlePlayButtonPress(buttonService);
      return;
    }

    const team = resolveTeamFromButtonService(buttonService);
    if (!team) {
      return;
    }

    if ($jacdacGameMode) {
      switchActiveTrainingTeam(team);
    }

    const now = Date.now();
    const key = buttonService.id;
    const last = lastTriggerAt.get(key) ?? 0;
    if (now - last < 180) return;

    lastTriggerAt.set(key, now);
    void runLedAndRecord(buttonService, team);
  }

  function subscribeToButtons() {
    cleanupSubscriptions();

    if (!get(connected)) return;

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

    buttonServices.forEach((buttonService) => {
      const downEvent = buttonService.event(ButtonEvent.Down);
      if (downEvent) {
        const unsubscribeEvent = downEvent.subscribe(CHANGE, () => {
          triggerWithCooldown(buttonService);
        });
        unsubscribers.push(unsubscribeEvent);
      }

      // Some button modules are more stable via register updates than events.
      const pressedRegister = buttonService.register(ButtonReg.Pressed);
      const unsubscribeRegister = pressedRegister.subscribe(CHANGE, () => {
        if (pressedRegister.boolValue) triggerWithCooldown(buttonService);
      });
      unsubscribers.push(unsubscribeRegister);
    });
  }

  onMount(() => {
    startTrainingWaitingAnimation();

    const unsubscribeDevices = jacdacDevices.subscribe((deviceList) => {
      knownDevices = [...deviceList];
      if (get(connected)) subscribeToButtons();
    });

    const unsubscribeConnected = connected.subscribe((isConnected) => {
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
      stopTrainingWaitingAnimation();
    };
  });
</script>

