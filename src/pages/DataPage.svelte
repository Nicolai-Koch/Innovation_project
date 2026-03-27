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
<main class="min-w-full max-w-full h-full min-h-0 flex flex-col">
  <DataPageJacdacRecordTrigger />

  <div class="shadow-md w-full h-12 flex items-center px-4">
    <div class="w-full flex flex-wrap items-center gap-x-20 gap-y-2 text-black font-semibold">
      <div class="text-sm sm:text-base">1. Tilføj en aktion</div>
      <div class="text-sm sm:text-base">2. Optag aktion</div>
      <div class="text-sm sm:text-base">3. Træn model</div>
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
