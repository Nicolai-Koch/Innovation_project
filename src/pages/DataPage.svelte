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

  <div class="overflow-x-auto p-3 flex-grow flex">
    {#if !$hasSomeRecordingData && !$gestures.length}
      <DataPageNoData />
    {:else}
      <DataPageWithData />
    {/if}
  </div>
</main>
