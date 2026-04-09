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
  import { activeTeam, classesPerRound, jacdacGameMode } from '../lib/stores/TeamGameStore';

  const gestures = stores.getGestures();
  const devices = stores.getDevices();

  $: if ($jacdacGameMode) {
    const existing = gestures.getGestures();
    for (let idx = existing.length; idx < $classesPerRound; idx++) {
      gestures.createGesture((idx + 1).toString());
    }
  }
</script>

<!-- Main pane -->
<main class="min-w-full max-w-full h-full min-h-0 flex flex-col">
  <DataPageJacdacRecordTrigger />

  {#if $devices.isInputConnected}
    <div class="flex justify-center px-3 pt-3">
      <div class="text-center w-2/3 text-primarytext">
        <p class="text-2xl font-bold">Træn din egen AI!</p>
        {#if !$gestures.length}
          <div class="text-left text-base mt-2 max-w-2xl mx-auto">
            {#if $jacdacGameMode}
              <p class="font-semibold">På denne side kan du:</p>
              <p>1. optage bevægelse til klasse 1, 2, 3 osv. for hold {$activeTeam}</p>
              <p>2. trykke på Jacdac-knappen for at optage</p>
              <p>3. lade systemet skifte automatisk til næste klasse efter 3 optagelser</p>
            {:else}
              <p class="font-semibold">På denne side kan du:</p>
              <p>1. trykke på + for at tilføje din helt egen data til AI</p>
              <p>2. navngiv din bevægelse</p>
              <p>
                3. tag din microbit i hånden og begynd at optage den bevægelse du har valgt.
                Her skal du bare trykke på knappen på din Jacdac
              </p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="overflow-auto p-3 flex-1 min-h-0 flex">
    {#if !$hasSomeRecordingData && !$gestures.length}
      <DataPageNoData />
    {:else}
      <DataPageWithData />
    {/if}
  </div>
</main>
