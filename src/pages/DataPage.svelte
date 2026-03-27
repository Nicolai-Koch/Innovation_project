<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { stores } from '../lib/stores/Stores';
  import { hasSomeRecordingData } from './data/DataPage';
  import DataPageNoData from './data/DataPageNoData.svelte';
  import DataPageWithData from './data/DataPageWithData.svelte';
  import DataPageJacdacRecordTrigger from '../lib/jacdac/DataPageJacdacRecordTrigger.svelte';

  const gestures = stores.getGestures();
</script>

<!-- Main pane -->
<main class="min-w-full flex flex-col max-w-full min-h-full">
  <DataPageJacdacRecordTrigger />

  <div class="shadow-md w-full flex items-center px-4 py-2">
    <div class="w-full flex flex-wrap items-center gap-x-8 gap-y-2 text-black font-semibold">
      <div class="text-sm sm:text-base">1. Tilføj en aktion</div>
      <div class="text-sm sm:text-base">2. Optag 3-5 gange pr. aktion</div>
      <div class="text-sm sm:text-base">3. Træn model</div>
    </div>
  </div>

  <div class="overflow-x-auto p-3 flex-grow flex">
    {#if !$hasSomeRecordingData && !$gestures.length}
      <DataPageNoData />
    {:else}
      <DataPageWithData />
    {/if}
  </div>
</main>
