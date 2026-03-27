<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { modelView, ModelView } from '../../lib/stores/ApplicationState';
  import StandardButton from '../../components/ui/buttons/StandardButton.svelte';
  import { stores } from '../../lib/stores/Stores';
  import {
    activeChallenge,
    activeChallengeNumber,
    setActiveChallenge,
  } from '../../lib/stores/BoardGameChallengeStore';
  import ModelPageStackView from './stackview/ModelPageStackView.svelte';
  import ModelPageTileView from './tileview/ModelPageTileView.svelte';

  const gestures = stores.getGestures();

  let selectedChallengeNumber = '';

  // Keep selector synced if active challenge is changed elsewhere.
  $: if ($activeChallengeNumber !== null) {
    selectedChallengeNumber = String($activeChallengeNumber);
  }
  $: if ($activeChallengeNumber === null) {
    selectedChallengeNumber = '';
  }

  const getGestureNameForChallenge = (challengeNumber: number): string => {
    const gesture = $gestures[challengeNumber - 1];
    return gesture ? gesture.name : 'Ingen klasse';
  };

  const useSelectedChallenge = () => {
    if (selectedChallengeNumber === '') {
      setActiveChallenge(null);
      return;
    }

    const parsedNumber = Number(selectedChallengeNumber);
    if (Number.isFinite(parsedNumber) && parsedNumber >= 1) {
      setActiveChallenge(Math.floor(parsedNumber));
    }
  };
</script>

<div class="pt-4 pl-3 pr-3">
  <div class="mb-3 rounded-xl border border-black border-opacity-20 bg-white bg-opacity-75 p-3">
    <div class="flex flex-wrap items-end gap-3">
      <div class="min-w-45">
        <p class="text-sm font-bold">Spiller-hold: vælg aktiv udfordring</p>
        <div class="mt-2 flex items-center gap-2">
          <select
            class="rounded border border-gray-400 px-2 py-1 min-w-55"
            bind:value={selectedChallengeNumber}
            on:change={useSelectedChallenge}>
            <option value="">Vælg udfordring</option>
            {#each $gestures as gesture, index (gesture.ID)}
              <option value={String(index + 1)}>#{index + 1} - {gesture.name}</option>
            {/each}
          </select>
          <StandardButton
            small
            outlined
            onClick={() => {
              selectedChallengeNumber = '';
              setActiveChallenge(null);
            }}>
            Ryd
          </StandardButton>
        </div>
      </div>

    </div>

    <div class="mt-3 text-sm">
      {#if $activeChallenge}
        Aktiv udfordring: <b>#{ $activeChallenge.challengeNumber }</b> -> <b>{getGestureNameForChallenge(
            $activeChallenge.challengeNumber,
          )}</b>
      {:else}
        Aktiv udfordring: <b>ingen valgt</b>
      {/if}
    </div>
    <div class="mt-1 text-xs text-gray-700">
      Udfordringsnummer følger klassernes rækkefølge på Data-siden (1 = første klasse).
    </div>
  </div>

  {#if $modelView == ModelView.TILE}
    <ModelPageTileView />
  {:else}
    <ModelPageStackView />
  {/if}
</div>
