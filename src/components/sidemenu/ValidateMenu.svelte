<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { currentPath, Paths } from '../../router/Router';
  import {
    hasStoredExampleDataset,
    importStoredOrDefaultExampleDataset,
    saveCurrentAsExampleDataset,
  } from '../../pages/data/DataPage';
  import { adminTestMode } from '../../lib/stores/TeamGameStore';
  import { stores } from '../../lib/stores/Stores';

  const accuracy = stores.getValidationResults().getAccuracy();
  const gestures = stores.getGestures();
  let customExampleExists = hasStoredExampleDataset();

  $: onTrainingPage = $currentPath === Paths.DATA;

  const saveExample = () => {
    if (!onTrainingPage) return;
    saveCurrentAsExampleDataset();
    customExampleExists = true;
  };

  const showExample = () => {
    if (!onTrainingPage) return;
    importStoredOrDefaultExampleDataset();
    customExampleExists = hasStoredExampleDataset();
  };
</script>

<div class="w-full text-center justify-center pt-5 pb-7">
  {#if !isNaN($accuracy)}
    <p class="text-4xl mb-4">{($accuracy * 100).toFixed(1)}%</p>
  {:else}
    <p class="text-4xl mb-4">-</p>
  {/if}
  <p class="text-xl">Accuracy</p>

  <div class="mt-6 flex flex-col items-center gap-2 px-3">
    <button
      type="button"
      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!onTrainingPage || !$gestures.length}
      on:click={saveExample}>
      Gem nuværende som dataeksempel
    </button>
    <button
      type="button"
      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!onTrainingPage}
      on:click={showExample}>
      {customExampleExists ? 'Vis dataeksempel' : 'Vis standard dataeksempel'}
    </button>
    {#if !onTrainingPage}
      <p class="text-xs text-slate-300">Kan kun bruges på Træn AI siden</p>
    {/if}

    <button
      type="button"
      class="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
      on:click={() => adminTestMode.update(value => !value)}>
      {#if $adminTestMode}Admin: slået til{:else}Admin: slået fra{/if}
    </button>
    <p class="text-xs text-slate-400 text-center">Bruges til test uden micro:bits</p>
  </div>
</div>
