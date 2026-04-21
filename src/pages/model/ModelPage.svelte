<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import LiveGraph from '../../components/features/graphs/LiveGraph.svelte';
  import { modelView, ModelView } from '../../lib/stores/ApplicationState';
  import TeamRacePredictionPanel from '../../components/features/model/TeamRacePredictionPanel.svelte';
  import ModelPageJacdacChallengeTrigger from '../../lib/jacdac/ModelPageJacdacChallengeTrigger.svelte';
  import {
    activeTeam,
    getTeamLiveDataSource,
    gamePhase,
    GamePhase,
    jacdacGameMode,
    raceWinner,
    teamATrainingComplete,
    teamBTrainingComplete,
  } from '../../lib/stores/TeamGameStore';
  import { stores } from '../../lib/stores/Stores';
  import StaticConfiguration from '../../StaticConfiguration';
  import ModelPageStackView from './stackview/ModelPageStackView.svelte';
  import ModelPageTileView from './tileview/ModelPageTileView.svelte';

  const devices = stores.getDevices();
  const teamALiveData = getTeamLiveDataSource('A');
  const teamBLiveData = getTeamLiveDataSource('B');
  let teamALiveWidth = 0;
  let teamBLiveWidth = 0;
  let swapLiveViews = false;

  onMount(() => {
    jacdacGameMode.set(true);
    stores.setLiveData(getTeamLiveDataSource(get(activeTeam)));
    stores.getAvailableAxes().loadFromGestures();
  });
</script>

<div class="pt-4 pl-3 pr-3">
  {#if $jacdacGameMode}
    <ModelPageJacdacChallengeTrigger />

    <div class="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
        <span>Fase: {$gamePhase}</span>
        <span>Hold A: {$teamATrainingComplete ? 'traenet' : 'ikke klar endnu'}</span>
        <span>Hold B: {$teamBTrainingComplete ? 'traenet' : 'ikke klar endnu'}</span>
        <span>
          {#if $raceWinner}
            Vinder: Hold {$raceWinner}
          {:else if $gamePhase === GamePhase.Paused || $gamePhase === GamePhase.Training}
            Afventer holdknap
          {:else if $gamePhase === GamePhase.Playing}
            Holdknap starter challenge-vindue
          {/if}
        </span>
      </div>
    </div>

    <div class="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Live data</p>
          <h2 class="mt-1 text-xl font-bold text-slate-900">Accelerometer</h2>
          <p class="mt-1 text-sm text-slate-600">
            Her kan du se de rå bevægelser fra begge hold i realtid.
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          on:click={() => (swapLiveViews = !swapLiveViews)}>
          {swapLiveViews ? 'Vis A/B normalt' : 'Byt A/B visning'}
        </button>
      </div>

      <div class="mb-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
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
          <span>{teamALiveWidth > 0 ? 'klar' : 'venter på layout'}</span>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span class="font-semibold text-slate-800">Hold B live:</span>
          <span>{teamBLiveWidth > 0 ? 'klar' : 'venter på layout'}</span>
        </div>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <div bind:clientWidth={teamALiveWidth} class="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-800">
              {swapLiveViews ? 'Hold B' : 'Hold A'}
            </p>
            <p class="text-xs text-slate-500">{$activeTeam === 'A' ? 'Aktivt hold' : 'Sekundært hold'}</p>
          </div>
          {#if teamALiveWidth > 0}
            <LiveGraph
              width={teamALiveWidth}
              liveData={swapLiveViews ? teamBLiveData : teamALiveData}
              minValue={StaticConfiguration.liveGraphValueBounds.min}
              maxValue={StaticConfiguration.liveGraphValueBounds.max} />
          {/if}
        </div>

        <div bind:clientWidth={teamBLiveWidth} class="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-800">
              {swapLiveViews ? 'Hold A' : 'Hold B'}
            </p>
            <p class="text-xs text-slate-500">{$activeTeam === 'B' ? 'Aktivt hold' : 'Sekundært hold'}</p>
          </div>
          {#if teamBLiveWidth > 0}
            <LiveGraph
              width={teamBLiveWidth}
              liveData={swapLiveViews ? teamALiveData : teamBLiveData}
              minValue={StaticConfiguration.liveGraphValueBounds.min}
              maxValue={StaticConfiguration.liveGraphValueBounds.max} />
          {/if}
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
