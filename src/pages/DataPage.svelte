<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { stores } from '../lib/stores/Stores';
  import {
    hasSomeRecordingData,
    loadTeamDatasetSnapshot,
    resetAllTeamTrainingData,
    saveTeamDatasetSnapshot,
    switchActiveTrainingTeam,
  } from './data/DataPage';
  import DataPageNoData from './data/DataPageNoData.svelte';
  import DataPageWithData from './data/DataPageWithData.svelte';
  import DataPageJacdacRecordTrigger from '../lib/jacdac/DataPageJacdacRecordTrigger.svelte';
  import { activeTeam, jacdacGameMode, type TeamKey } from '../lib/stores/TeamGameStore';

  const gestures = stores.getGestures();

  const showTeam = (team: TeamKey) => {
    switchActiveTrainingTeam(team);
  };

  const clearAllTeamData = () => {
    resetAllTeamTrainingData();
  };

  onMount(() => {
    if ($jacdacGameMode) {
      loadTeamDatasetSnapshot($activeTeam);
    }
  });

  $: if ($jacdacGameMode) {
    saveTeamDatasetSnapshot($activeTeam);
  }
</script>

<!-- Main pane -->
<main class="min-w-full max-w-full h-full min-h-0 flex flex-col">
  <DataPageJacdacRecordTrigger />

  {#if $jacdacGameMode}
    <div class="mx-4 mt-2 rounded-xl border border-black border-opacity-15 bg-white bg-opacity-75 p-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg border px-3 py-1 text-sm font-semibold transition"
            class:border-blue-500={$activeTeam === 'A'}
            class:bg-blue-50={$activeTeam === 'A'}
            class:text-blue-800={$activeTeam === 'A'}
            class:border-slate-300={$activeTeam !== 'A'}
            class:bg-white={$activeTeam !== 'A'}
            class:text-slate-700={$activeTeam !== 'A'}
            on:click={() => showTeam('A')}>
            Hold A træningsdata
          </button>
          <button
            type="button"
            class="rounded-lg border px-3 py-1 text-sm font-semibold transition"
            class:border-red-500={$activeTeam === 'B'}
            class:bg-red-50={$activeTeam === 'B'}
            class:text-red-800={$activeTeam === 'B'}
            class:border-slate-300={$activeTeam !== 'B'}
            class:bg-white={$activeTeam !== 'B'}
            class:text-slate-700={$activeTeam !== 'B'}
            on:click={() => showTeam('B')}>
            Hold B træningsdata
          </button>
        </div>

        <button
          type="button"
          class="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition"
          on:click={clearAllTeamData}>
          Ryd alle optagelser (begge hold)
        </button>
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
