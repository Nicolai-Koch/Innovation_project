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

  <div class="h-12 shadow-md w-full flex items-center justify-center px-3">
    <div class="w-full flex flex-row items-center gap-2 text-black font-semibold text-lg">
      <div class="w-50 text-center">1. Tilføj en aktion</div>
      <div class="w-35 text-center">2. Optag</div>
      <div class="flex-1 text-center">3. Se dine bevægelser</div>
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
