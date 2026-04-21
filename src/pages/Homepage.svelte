<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { stores } from '../lib/stores/Stores';
  import { connectToBus, connected, error, initializeBus } from '../lib/jacdac/stores';
  import ConnectDialogContainer from '../components/features/connection-prompt/ConnectDialogContainer.svelte';
  import StandardButton from '../components/ui/buttons/StandardButton.svelte';
  import { startConnectionProcess } from '../lib/stores/connectDialogStore';
  import { Paths, navigate } from '../router/Router';
  import { isLoading } from '../lib/stores/ApplicationState';
  import {
    getTeamColorIndexById,
    isColorLockedForTeam,
    startCompetitiveRound,
    GamePhase,
    gamePhase,
    resetGameSession,
    teamAColorId,
    teamBColorId,
    teamAConfirmed,
    teamBConfirmed,
    teamColorPalette,
    setTeamColorByIndex,
    teamAScore,
    teamBScore,
  } from '../lib/stores/TeamGameStore';
  import { installGameSetupJacdacController } from '../lib/jacdac/stores';

  const devices = stores.getDevices();

  const teamColorById = (id: string | null) =>
    teamColorPalette.find(color => color.id === id) ?? null;

  $: teamAColor = teamColorById($teamAColorId);
  $: teamBColor = teamColorById($teamBColorId);
  $: setupReady =
    !!teamAColor &&
    !!teamBColor &&
    $teamAConfirmed &&
    $teamBConfirmed &&
    $devices.isInputAssigned &&
    $devices.isOutputAssigned &&
    $connected;

  onMount(() => {
    initializeBus();
    const cleanupGameSetupController = installGameSetupJacdacController();
    return cleanupGameSetupController;
  });

  const chooseTeamColor = (team: 'A' | 'B', colorId: string) => {
    if (isColorLockedForTeam(team, colorId)) {
      return;
    }

    const colorIndex = getTeamColorIndexById(colorId);
    setTeamColorByIndex(team, colorIndex);
  };

  const openMicrobitConnect = () => {
    startConnectionProcess();
  };

  const openJacdacConnect = async () => {
    await connectToBus();
  };

  const goToTrainingStep = () => {
    if (!setupReady) {
      return;
    }
    startCompetitiveRound();
    navigate(Paths.DATA);
  };
</script>

<main class="h-full w-full" class:hidden={$isLoading}>
  <ConnectDialogContainer />

  <div class="h-full w-full flex items-center justify-center p-6">
    <div class="w-full max-w-6xl rounded-2xl border border-gray-200 bg-white shadow-xl p-6 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-center mb-2">Game Setup</h1>
      <p class="text-center text-gray-700 mb-6">
        Drej rotary encoder for at vælge farve, tryk på holdknappen for at bekræfte. Tryk holdknappen igen for at låse op og ændre farve.
      </p>

      <div class="mb-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={goToTrainingStep}
          disabled={!setupReady}
          title={setupReady ? 'Gå til træning' : 'Alle tilslutninger skal være klar'}>
          Gå til træning
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch mb-6">
        <section class="rounded-2xl border border-gray-200 p-5 bg-slate-50/60">
          <p class="font-semibold mb-3 text-lg">Hold A</p>
          <div class="grid grid-cols-3 gap-2 mb-4">
            {#each teamColorPalette as color (color.id)}
              <button
                type="button"
                class="h-10 rounded border-2 transition"
                class:border-black={$teamAColorId === color.id}
                class:border-transparent={$teamAColorId !== color.id}
                class:opacity-40={isColorLockedForTeam('A', color.id)}
                disabled={isColorLockedForTeam('A', color.id)}
                style={`background-color: ${color.hex};`}
                on:click={() => chooseTeamColor('A', color.id)}
                aria-label={`Vaelg ${color.label} til hold A`} />
            {/each}
          </div>
          <div class="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm mb-3">
            <p class="font-semibold">Status</p>
            <p class={$teamAConfirmed ? 'text-green-700' : 'text-amber-700'}>
              {$teamAConfirmed ? 'Bekræftet (tryk igen for at låse op)' : 'Venter på knaptryk'}
            </p>
          </div>
          <div class="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm mb-3">
            <p class="font-semibold">Valgt farve</p>
            <p>{teamAColor ? teamAColor.label : 'Ingen'}</p>
          </div>
          <div class="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm mb-3">
            <p class="font-semibold">Micro:bit</p>
            <p class={$devices.isInputAssigned ? 'text-green-700' : 'text-amber-700'}>
              {$devices.isInputAssigned ? 'Tilkoblet' : 'Mangler'}
            </p>
          </div>
          <StandardButton medium onClick={openMicrobitConnect}>
            Tilslut hold A micro:bit
          </StandardButton>
        </section>

        <section class="rounded-2xl border border-gray-200 p-5 bg-white flex flex-col justify-between">
          <div>
            <p class="font-semibold mb-3 text-lg text-center">Jacdac</p>
            <div class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-4 text-sm text-slate-700 text-center mb-4">
              <p class="font-semibold">Tilslut Jacdac-moduler her</p>
            </div>
            <div class="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm mb-3">
              <p class="font-semibold">Status</p>
              <p class={$connected ? 'text-green-700' : 'text-amber-700'}>
                {$connected ? 'Tilkoblet' : 'Mangler'}
              </p>
            </div>
            {#if $error}
              <p class="mt-3 text-sm text-red-700">Jacdac fejl: {$error}</p>
            {/if}
          </div>

          <div class="flex justify-center mt-4">
            <StandardButton medium onClick={openJacdacConnect}>
              Tilslut Jacdac
            </StandardButton>
          </div>
        </section>

        <section class="rounded-2xl border border-gray-200 p-5 bg-slate-50/60">
          <p class="font-semibold mb-3 text-lg">Hold B</p>
          <div class="grid grid-cols-3 gap-2 mb-4">
            {#each teamColorPalette as color (color.id)}
              <button
                type="button"
                class="h-10 rounded border-2 transition"
                class:border-black={$teamBColorId === color.id}
                class:border-transparent={$teamBColorId !== color.id}
                class:opacity-40={isColorLockedForTeam('B', color.id)}
                disabled={isColorLockedForTeam('B', color.id)}
                style={`background-color: ${color.hex};`}
                on:click={() => chooseTeamColor('B', color.id)}
                aria-label={`Vaelg ${color.label} til hold B`} />
            {/each}
          </div>
          <div class="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm mb-3">
            <p class="font-semibold">Status</p>
            <p class={$teamBConfirmed ? 'text-green-700' : 'text-amber-700'}>
              {$teamBConfirmed ? 'Bekræftet (tryk igen for at låse op)' : 'Venter på knaptryk'}
            </p>
          </div>
          <div class="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm mb-3">
            <p class="font-semibold">Valgt farve</p>
            <p>{teamBColor ? teamBColor.label : 'Ingen'}</p>
          </div>
          <div class="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm mb-3">
            <p class="font-semibold">Micro:bit</p>
            <p class={$devices.isOutputAssigned ? 'text-green-700' : 'text-amber-700'}>
              {$devices.isOutputAssigned ? 'Tilkoblet' : 'Mangler'}
            </p>
          </div>
          <StandardButton medium onClick={openMicrobitConnect}>
            Tilslut hold B micro:bit
          </StandardButton>
        </section>
      </div>

      <div class="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex flex-wrap items-center justify-between gap-2">
        <span>Fase: {$gamePhase}</span>
        <span>Score hold A: {$teamAScore}</span>
        <span>Score hold B: {$teamBScore}</span>
        <span>Hold A: {$teamAConfirmed ? 'Klar' : 'Afventer'}</span>
        <span>Hold B: {$teamBConfirmed ? 'Klar' : 'Afventer'}</span>
        <button
          type="button"
          class="rounded border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100"
          on:click={resetGameSession}>
          Nulstil spil
        </button>
      </div>
    </div>
  </div>
</main>
