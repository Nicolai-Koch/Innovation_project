<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    LedReg,
    SRV_MAGNETIC_FIELD_LEVEL,
    MagneticFieldLevelReg,
  } from 'jacdac-ts';
  import type { JDService } from 'jacdac-ts';

  export let magnetServices: JDService[] = [];
  export let ledServices: JDService[] = [];

  let selectedMagnetIdx = 0;
  let selectedLedIdx = 0;
  let threshold = 50;
  let latestReading = 0;
  let status = 'Idle';
  let running = false;

  let timer: ReturnType<typeof setInterval> | undefined;
  let tickInProgress = false;
  let blinkOn = false;
  const ledPixelCount = new Map<string, number>();

  $: if (selectedMagnetIdx >= magnetServices.length) selectedMagnetIdx = 0;
  $: if (selectedLedIdx >= ledServices.length) selectedLedIdx = 0;

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function readMagnetValue(service: JDService): Promise<number> {
    const register = service.register(MagneticFieldLevelReg.Strength);
    await register.refresh(true);
    return register.intValue ?? register.uintValue ?? 0;
  }

  async function getLedPixelCount(service: JDService): Promise<number> {
    const cacheKey = service.id;
    const cached = ledPixelCount.get(cacheKey);
    if (cached) return cached;

    const numPixelsRegister = service.register(LedReg.NumPixels);
    let n = 0;
    for (let i = 0; i < 8 && n <= 0; i++) {
      await numPixelsRegister.refresh(true);
      n = numPixelsRegister.uintValue ?? 0;
      if (n <= 0) await delay(80);
    }

    if (n > 0) ledPixelCount.set(cacheKey, n);
    return n;
  }

  async function setLed(service: JDService, on: boolean) {
    const count = await getLedPixelCount(service);
    if (!count) return;

    const pixels = new Uint8Array(count * 3);
    if (on) {
      for (let i = 0; i < count; i++) {
        pixels[i * 3] = 255;
        pixels[i * 3 + 1] = 255;
        pixels[i * 3 + 2] = 255;
      }
    }

    await service.register(LedReg.Pixels).sendSetPackedAsync([pixels], true);
  }

  async function tick() {
    if (tickInProgress || !running) return;
    tickInProgress = true;

    try {
      const magnetService = magnetServices[selectedMagnetIdx];
      const ledService = ledServices[selectedLedIdx];
      if (!magnetService || !ledService) {
        status = 'Missing magnet sensor or LED ring.';
        running = false;
        stopLoop();
        return;
      }

      latestReading = await readMagnetValue(magnetService);

      if (latestReading >= threshold) {
        blinkOn = !blinkOn;
        await setLed(ledService, blinkOn);
        status = `Magnetic field detected (>= ${threshold}) - blinking`;
      } else {
        blinkOn = false;
        await setLed(ledService, false);
        status = `Below threshold (${threshold}) - LED off`;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      status = `Automation error: ${message}`;
    } finally {
      tickInProgress = false;
    }
  }

  function stopLoop() {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  async function startAutomation() {
    if (running) return;
    if (!magnetServices.length || !ledServices.length) {
      status = 'Connect one magnet sensor and one LED ring first.';
      return;
    }

    running = true;
    status = 'Starting magnet-to-LED automation...';
    timer = setInterval(() => {
      void tick();
    }, 220);
    await tick();
  }

  async function stopAutomation() {
    running = false;
    stopLoop();

    const ledService = ledServices[selectedLedIdx];
    if (ledService) {
      try {
        await setLed(ledService, false);
      } catch {
        // Ignore cleanup errors during disconnects.
      }
    }

    status = 'Stopped';
  }

  onDestroy(() => {
    void stopAutomation();
  });
</script>

<div class="automation">
  <div class="row">
    <label for="magnet-svc">Magnet sensor</label>
    <select id="magnet-svc" bind:value={selectedMagnetIdx} disabled={running || magnetServices.length === 0}>
      {#each magnetServices as service, idx}
        <option value={idx}>
          {service.device?.friendlyName || service.device?.name || 'Unknown device'}
        </option>
      {/each}
    </select>
  </div>

  <div class="row">
    <label for="led-svc">LED ring</label>
    <select id="led-svc" bind:value={selectedLedIdx} disabled={running || ledServices.length === 0}>
      {#each ledServices as service, idx}
        <option value={idx}>
          {service.device?.friendlyName || service.device?.name || 'Unknown device'}
        </option>
      {/each}
    </select>
  </div>

  <div class="row">
    <label for="threshold">Threshold</label>
    <input
      id="threshold"
      type="number"
      min="0"
      max="1000"
      step="1"
      bind:value={threshold}
      disabled={running}
    />
  </div>

  <div class="actions">
    <button on:click={startAutomation} disabled={running || magnetServices.length === 0 || ledServices.length === 0}>
      Start
    </button>
    <button on:click={stopAutomation} disabled={!running}>Stop</button>
  </div>

  <p class="reading">Latest magnet reading: {latestReading}</p>
  <p class="status" class:running>{status}</p>
</div>

<style>
  .automation {
    background: #fff;
    border: 1px solid #d9e1ec;
    border-radius: 6px;
    padding: 0.75rem;
  }

  .row {
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.55rem;
  }

  label {
    font-size: 0.85rem;
    color: #334155;
  }

  select,
  input {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 0.35rem 0.45rem;
    font-size: 0.85rem;
    min-width: 0;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
    margin-bottom: 0.5rem;
  }

  button {
    padding: 0.35rem 0.7rem;
    border-radius: 6px;
    border: 1px solid #1d4ed8;
    background: #2563eb;
    color: white;
    font-size: 0.85rem;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reading,
  .status {
    margin: 0;
    font-size: 0.82rem;
    color: #334155;
  }

  .status {
    margin-top: 0.35rem;
  }

  .status.running {
    color: #0f766e;
    font-weight: 600;
  }
</style>
