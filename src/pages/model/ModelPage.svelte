<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { modelView, ModelView } from '../../lib/stores/ApplicationState';
  import ModelPageStackView from './stackview/ModelPageStackView.svelte';
  import ModelPageTileView from './tileview/ModelPageTileView.svelte';
  import {
    activeTeam,
    GamePhase,
    gamePhase,
    resolveCompetitiveRound,
    setGamePhase,
    teamAScore,
    teamBScore,
  } from '../../lib/stores/TeamGameStore';
  import GameControlJacdacTrigger from '../../lib/jacdac/GameControlJacdacTrigger.svelte';

  const toggleGamePhase = () => {
    if ($gamePhase === GamePhase.Playing) {
      setGamePhase(GamePhase.Paused);
      return;
    }
    setGamePhase(GamePhase.Playing);
  };
</script>

<div class="pt-4 pl-3 pr-3">
  <div class="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
    <span>Fase: {$gamePhase}</span>
    <span>Aktivt hold: Hold {$activeTeam}</span>
    <span>Score A: {$teamAScore}</span>
    <span>Score B: {$teamBScore}</span>
    <button
      type="button"
      class="rounded border border-slate-300 bg-white px-3 py-1 font-semibold hover:bg-slate-100"
      on:click={toggleGamePhase}>
      {$gamePhase === GamePhase.Playing ? 'Pause spil' : 'Start spil'}
    </button>
  </div>

  {#if $gamePhase === GamePhase.Playing}
    <div class="mb-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 flex flex-wrap gap-2 items-center justify-between">
      <span>Scor den aktuelle runde manuelt indtil obstacle-logikken er koblet på.</span>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border border-blue-300 bg-blue-50 px-3 py-1 font-semibold text-blue-800 hover:bg-blue-100"
          on:click={() => resolveCompetitiveRound('A')}>
          Hold A vinder runden
        </button>
        <button
          type="button"
          class="rounded border border-red-300 bg-red-50 px-3 py-1 font-semibold text-red-800 hover:bg-red-100"
          on:click={() => resolveCompetitiveRound('B')}>
          Hold B vinder runden
        </button>
        <button
          type="button"
          class="rounded border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100"
          on:click={() => resolveCompetitiveRound(null)}>
          Uafgjort
        </button>
      </div>
    </div>
  {/if}

  <div class="mb-4">
    <GameControlJacdacTrigger />
  </div>

  {#if $modelView == ModelView.TILE}
    <ModelPageTileView />
  {:else}
    <ModelPageStackView />
  {/if}
</div>
