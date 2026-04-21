<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import StandardDialog from '../../components/ui/dialogs/StandardDialog.svelte';
  import { startConnectionProcess } from '../../lib/stores/connectDialogStore';
  import { t } from '../../i18n';
  import Gesture from '../../components/features/datacollection/Gesture.svelte';
  import NewGestureButton from '../../components/features/NewGestureButton.svelte';
  import { stores } from '../../lib/stores/Stores';
  import StandardButton from '../../components/ui/buttons/StandardButton.svelte';
  import ConnectDialogContainer from '../../components/features/connection-prompt/ConnectDialogContainer.svelte';
  import StaticConfiguration from '../../StaticConfiguration';
  import { requestedExtraRecordingRequest } from '../../lib/stores/ExtraRecordingStore';
  import { trainBothTeamModels } from '../training/TrainingPage';
  import {
    areBothTeamsTrainingComplete,
    activeTeam,
    GamePhase,
    jacdacGameMode,
    markTeamTrainingComplete,
    setActiveTeam,
    setGamePhase,
    teamATrainingComplete,
    teamBTrainingComplete,
  } from '../../lib/stores/TeamGameStore';

  let isConnectionDialogOpen = false;
  const gestures = stores.getGestures();
  const minNoOfRecordingsPerGesture = StaticConfiguration.minNoOfRecordingsPerGesture;

  const targetRecordingsForGesture = (gesture: { ID: number; recordings: unknown[] }) => {
    const requestedTarget =
      $requestedExtraRecordingRequest?.gestureId === gesture.ID
        ? $requestedExtraRecordingRequest.targetRecordings
        : minNoOfRecordingsPerGesture;
    return Math.max(minNoOfRecordingsPerGesture, requestedTarget, gesture.recordings.length);
  };

  const finishCurrentTeamTraining = () => {
    if ($activeTeam === 'A') {
      markTeamTrainingComplete('A', true);
      setActiveTeam('B');
      return;
    }

    markTeamTrainingComplete('B', true);
    if (areBothTeamsTrainingComplete()) {
      setGamePhase(GamePhase.Paused);
    }
  };

  const trainNow = async () => {
    await trainBothTeamModels();
  };
</script>

<StandardDialog
  isOpen={isConnectionDialogOpen}
  onClose={() => (isConnectionDialogOpen = false)}>
  <div class="w-70 text-center">
    <p class="mb-5">
      {$t('content.data.addDataNoConnection')}
    </p>
    <StandardButton
      onClick={() => {
        isConnectionDialogOpen = false;
        startConnectionProcess();
      }}>
      {$t('footer.connectButtonNotConnected')}
    </StandardButton>
  </div>
</StandardDialog>
<ConnectDialogContainer />

<!-- Display all gestures -->
<div class="flex flex-col gap-2 pt-3">

  {#if $jacdacGameMode}
    <div class="ml-2 mr-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 flex flex-wrap items-center gap-3 justify-between">
      <span>Hold A traener klasse 1-3. Hold B traener klasse 4-6.</span>
      <span>Aktivt hold: Hold {$activeTeam}</span>
      <span>Hold A: {$teamATrainingComplete ? 'færdig' : 'træner'}</span>
      <span>Hold B: {$teamBTrainingComplete ? 'færdig' : 'træner'}</span>
    </div>
  {/if}

  {#each $gestures as gesture (gesture.ID)}
    {@const targetRecordings = targetRecordingsForGesture(gesture)}
    <div class="ml-2 mr-4 mb-1 w-full" style="max-width: 30rem;">
      <div class="flex items-center justify-between text-xs text-gray-700 font-semibold mb-1">
        <span>Optagelser: {gesture.recordings.length}/{targetRecordings}</span>
        <span class:text-green-700={gesture.recordings.length >= targetRecordings}>
          {gesture.recordings.length >= targetRecordings ? 'Klar til træning' : 'Mangler optagelser'}
        </span>
      </div>
      <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="h-full bg-secondary rounded-full transition-all duration-200"
          style={`width: ${Math.min((gesture.recordings.length / targetRecordings) * 100, 100)}%;`} />
      </div>
    </div>
    <Gesture
      gesture={gestures.getGesture(gesture.ID)}
      onNoMicrobitSelect={() => (isConnectionDialogOpen = true)} />
  {/each}
  {#if !$jacdacGameMode}
    <NewGestureButton />
  {:else if $activeTeam === 'A' && !$teamATrainingComplete}
    <button
      type="button"
      class="ml-2 mr-4 mt-2 rounded-lg border border-teal-600 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 transition"
      on:click={finishCurrentTeamTraining}>
      Hold A klar til næste hold
    </button>
  {:else if $activeTeam === 'B' && !$teamBTrainingComplete}
    <button
      type="button"
      class="ml-2 mr-4 mt-2 rounded-lg border border-teal-600 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 transition"
      on:click={finishCurrentTeamTraining}>
      Hold B klar til spil
    </button>
  {:else}
    <div class="ml-2 mr-4 mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Begge hold er klar. Brug play-knappen for at traene modellen og gaa til spil.
    </div>
  {/if}
</div>
