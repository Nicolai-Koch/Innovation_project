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
  import { stores } from '../stores/Stores';
  import { buttonPressed, chosenGesture, microbitInteraction, MicrobitInteractions } from '../stores/uiStore';
  import { Feature, getFeature } from '../FeatureToggles';

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

  function resolveLedService(buttonService: JDService): JDService | undefined {
    const sameDeviceLed = buttonService.device
      ?.services()
      .find((service) => service.serviceClass === SRV_LED);
    if (sameDeviceLed) return sameDeviceLed;

    return getLedServices()[0];
  }

  function triggerDataRecording() {
    const gestures = stores.getGestures().getGestures();
    const topGesture = gestures[0];
    if (!topGesture) return;

    chosenGesture.set(topGesture);

    const interaction = get(microbitInteraction);
    if (interaction === MicrobitInteractions.A) {
      buttonPressed.set({ buttonA: 1, buttonB: 0 });
    } else if (interaction === MicrobitInteractions.B) {
      buttonPressed.set({ buttonA: 0, buttonB: 1 });
    } else {
      buttonPressed.set({ buttonA: 1, buttonB: 1 });
    }
  }

  async function runLedAndRecord(buttonService: JDService) {
    if (triggerInProgress) return;
    triggerInProgress = true;

    const ledService = resolveLedService(buttonService);
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

      triggerDataRecording();

      await delay(recordingDuration + 80);

      await setLedColor(ledService, 255, 0, 0);
      await delay(3000);
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
