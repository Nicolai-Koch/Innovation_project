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
  import { connected, devices as jacdacDevices } from './stores';
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
  import { trainKNNModel, trainNNModel } from '../../pages/training/TrainingPage.ts';
  import ModelRegistry from '../domain/ModelRegistry';
  import { modelTrainingInProgress } from '../stores/ApplicationState';
  import { classesPerRound, jacdacGameMode } from '../stores/TeamGameStore';

  let knownDevices: JDDevice[] = [];
  let triggerInProgress = false;
  let unsubscribers: (() => void)[] = [];
  let lastTriggerAt = new Map<string, number>();
  const ledPixelCount = new Map<string, number>();

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

  async function setCountdownWhiteLeds(service: JDService | undefined, litCount: number) {
    if (!service) return;

    const count = await getLedPixelCount(service);
    if (!count) return;

    const activeLeds = Math.min(count, 8);
    const safeLitCount = Math.max(0, Math.min(litCount, activeLeds));
    const pixels = new Uint8Array(count * 3);

    for (let i = 0; i < count; i++) {
      const isLit = i < safeLitCount;
      pixels[i * 3] = isLit ? 255 : 0;
      pixels[i * 3 + 1] = isLit ? 255 : 0;
      pixels[i * 3 + 2] = isLit ? 255 : 0;
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

  async function runLedAndRecord(buttonService: JDService) {
    if ($modelTrainingInProgress) return;

    const requestedExtraContext = getRequestedExtraRecordingContext();
    const hasRecordingTarget = !!getNextGestureToRecord();
    const ledService = resolveLedService(buttonService);

    if (!requestedExtraContext && hasEnoughDataToTrain()) {
      await trainModelFromDataPage(ledService);
      return;
    }

    // If all current classes are filled and we do not yet have enough data to train,
    // do nothing until the user adds a new class.
    if (!hasRecordingTarget && !requestedExtraContext) {
      return;
    }

    // Check if there are multiple incomplete gestures - user should finish the previous one
    const incompleteGestures = getIncompleteGestures();
    if (incompleteGestures.length > 1) {
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
        await setCountdownWhiteLeds(ledService, litLeds);
        await delay(Math.floor(countdownDuration / 8));
      }

      await setCountdownWhiteLeds(ledService, 0);
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
      await setLedColor(ledService, 0, 0, 0);
    } catch (e) {
      console.error('Jacdac data trigger failed:', e);
    } finally {
      triggerInProgress = false;
    }
  }

  function triggerWithCooldown(buttonService: JDService) {
    if (triggerInProgress) return;

    const now = Date.now();
    const key = buttonService.id;
    const last = lastTriggerAt.get(key) ?? 0;
    if (now - last < 180) return;

    lastTriggerAt.set(key, now);
    void runLedAndRecord(buttonService);
  }

  function subscribeToButtons() {
    cleanupSubscriptions();

    if (!get(connected)) return;

    const buttonServices = getButtonServices();
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
    };
  });
</script>

