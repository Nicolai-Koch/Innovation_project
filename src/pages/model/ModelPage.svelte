<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { modelView, ModelView } from '../../lib/stores/ApplicationState';
  import TeamRacePredictionPanel from '../../components/features/model/TeamRacePredictionPanel.svelte';
  import ModelPageJacdacChallengeTrigger from '../../lib/jacdac/ModelPageJacdacChallengeTrigger.svelte';
  import { activeTeam, getTeamLiveDataSource, jacdacGameMode } from '../../lib/stores/TeamGameStore';
  import { stores } from '../../lib/stores/Stores';
  import ModelPageStackView from './stackview/ModelPageStackView.svelte';
  import ModelPageTileView from './tileview/ModelPageTileView.svelte';

  const devices = stores.getDevices();

  onMount(() => {
    jacdacGameMode.set(true);
    stores.setLiveData(getTeamLiveDataSource(get(activeTeam)));
    stores.getAvailableAxes().loadFromGestures();
  });
</script>

<div class="pt-4 pl-3 pr-3">
  {#if $jacdacGameMode}
    <ModelPageJacdacChallengeTrigger />

    <div class="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div class="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span class="font-semibold text-slate-800">Input microbit:</span>
          <span>{$devices.isInputReady ? 'tilkoblet' : 'mangler'}</span>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span class="font-semibold text-slate-800">Output microbit:</span>
          <span>{$devices.isOutputReady ? 'tilkoblet' : 'mangler'}</span>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span class="font-semibold text-slate-800">Hold A live:</span>
          <span>klar</span>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span class="font-semibold text-slate-800">Hold B live:</span>
          <span>klar</span>
        </div>
      </div>
    </div>

    <div class="mb-4 grid gap-4 xl:grid-cols-2">
      <TeamRacePredictionPanel team="A" />
      <TeamRacePredictionPanel team="B" />
    </div>
  {:else}
    {#if $modelView == ModelView.TILE}
      <ModelPageTileView />
    {:else}
      <ModelPageStackView />
    {/if}
  {/if}
</div>
