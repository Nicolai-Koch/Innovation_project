<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { stores } from '../lib/stores/Stores';
  import StaticConfiguration from '../StaticConfiguration';
  import { hasSomeRecordingData } from './data/DataPage';
  import DataPageNoData from './data/DataPageNoData.svelte';
  import DataPageWithData from './data/DataPageWithData.svelte';
  import DataPageJacdacRecordTrigger from '../lib/jacdac/DataPageJacdacRecordTrigger.svelte';

  const gestures = stores.getGestures();
  const devices = stores.getDevices();
  const minNoOfGestures = StaticConfiguration.minNoOfGestures;
  const minNoOfRecordingsPerGesture = StaticConfiguration.minNoOfRecordingsPerGesture;

  $: hasAnyGestures = $gestures.length > 0;
  $: hasAnyRecordings = $hasSomeRecordingData;
  $: sufficientData =
    $gestures.length >= minNoOfGestures &&
    $gestures.every(gesture => gesture.recordings.length >= minNoOfRecordingsPerGesture);

  $: currentStep = (() => {
    if (!$devices.isInputConnected) {
      return 1;
    }
    if (!hasAnyGestures) {
      return 2;
    }
    if (!hasAnyRecordings) {
      return 3;
    }
    if (!sufficientData) {
      return 4;
    }
    return 5;
  })();
</script>

<!-- Main pane -->
<main class="min-w-full max-w-full h-full min-h-0 flex flex-col">
  <DataPageJacdacRecordTrigger />

  <div class="shadow-md w-full h-12 flex items-center px-4">
    <div class="w-full flex flex-wrap items-center gap-x-20 gap-y-2 text-black font-semibold">
      <div class="text-sm sm:text-base">1. Skriv navn på bevægelse</div>
      <div class="text-sm sm:text-base">2. Tryk Jacdac-knappen for optagelse</div>
      <div class="text-sm sm:text-base">3. Tryk Jacdac-knappen for at træne modellen</div>
    </div>
  </div>

  <div class="mx-4 mt-2 rounded-xl border border-black border-opacity-15 bg-white bg-opacity-75 p-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm font-bold">Start her</p>
        <p class="text-xs text-gray-700">
          {#if currentStep === 1}
            Trin 1/5: Tilslut micro:bit nederst.
          {:else if currentStep === 2}
            Trin 2/5: Tilføj mindst {minNoOfGestures} bevægelser og skriv navn på dem.
          {:else if currentStep === 3}
            Trin 3/5: Vælg en bevægelse og tryk Jacdac-knappen for at optage.
          {:else if currentStep === 4}
            Trin 4/5: Tryk Jacdac-knappen igen, indtil hver bevægelse har {minNoOfRecordingsPerGesture} optagelser.
          {:else}
            Klar! Trin 5/5: Tryk Jacdac-knappen for at træne modellen igen når du vil.
          {/if}
        </p>
      </div>
    </div>
  </div>

  <div class="overflow-auto p-3 flex-1 min-h-0 flex">
    {#if !$hasSomeRecordingData && !$gestures.length}
      <DataPageNoData />
    {:else}
      <DataPageWithData />
    {/if}
  </div>
</main>
