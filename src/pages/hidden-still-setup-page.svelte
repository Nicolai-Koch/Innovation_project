<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors

  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import StaticConfiguration from '../StaticConfiguration';
  import { Paths, navigate } from '../router/Router';
  import { areActionsAllowed, alertUser } from '../lib/stores/uiStore';
  import { startRecording } from '../lib/utils/Recording';
  import type { RecordingData } from '../lib/domain/RecordingData';
  import {
    addHiddenStillRecording,
    getHiddenStillRecordings,
    isHiddenStillRecordingsLocked,
    lockHiddenStillRecordings,
    removeHiddenStillRecording,
  } from './data/DataPage';

  let recordings: RecordingData[] = [];
  let isRecording = false;
  let isLocked = false;

  const requiredRecordings = StaticConfiguration.minNoOfRecordingsPerGesture;

  const refreshState = () => {
    recordings = getHiddenStillRecordings();
    isLocked = isHiddenStillRecordingsLocked();
  };

  refreshState();

  const goBack = () => {
    navigate(Paths.DATA);
  };

  const startStillRecording = () => {
    if (isLocked) {
      alertUser('Still-opsætningen er låst og kan ikke ændres.');
      return;
    }

    if (!areActionsAllowed()) {
      return;
    }

    isRecording = true;
    startRecording(recording => {
      isRecording = false;
      recordings = addHiddenStillRecording(recording);
    });
  };

  const removeRecording = (recordingId: number) => {
    if (isLocked) {
      alertUser('Still-opsætningen er låst og kan ikke ændres.');
      return;
    }

    recordings = removeHiddenStillRecording(recordingId);
  };

  const lockSetup = () => {
    if (recordings.length < requiredRecordings) {
      alertUser(
        `Optag mindst ${requiredRecordings} still-optagelser foer du laaser opsaetningen.`,
      );
      return;
    }

    if (!window.confirm('Laas still-opsaetningen? Dette kan ikke fortrydes i UI.')) {
      return;
    }

    lockHiddenStillRecordings();
    isLocked = true;
  };
</script>

<main class="h-full w-full p-6 flex items-center justify-center">
  <div class="w-full max-w-3xl rounded-2xl border border-slate-300 bg-white p-6 shadow-xl">
    <h1 class="text-2xl font-bold text-slate-800 mb-2">Skjult still-opsaetning</h1>
    <p class="text-slate-600 mb-4">
      Her optager du "stille" data til en skjult klasse. Klassen vises ikke i bruger-flowet,
      men bruges i traening for at undgaa falske gæt.
    </p>

    <div class="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <p>Antal still-optagelser: <span class="font-semibold">{recordings.length}</span></p>
      <p>Minimum for laas: <span class="font-semibold">{requiredRecordings}</span></p>
      <p>
        Status:
        <span class={isLocked ? 'font-semibold text-red-700' : 'font-semibold text-green-700'}>
          {isLocked ? 'Laast' : 'Aaben for redigering'}
        </span>
      </p>
    </div>

    <div class="flex flex-wrap gap-2 mb-4">
      <button
        type="button"
        class="rounded-lg border border-emerald-400 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        on:click={startStillRecording}
        disabled={isLocked || isRecording}>
        {isRecording ? 'Optager...' : 'Optag still-bevaegelse'}
      </button>

      <button
        type="button"
        class="rounded-lg border border-rose-400 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
        on:click={lockSetup}
        disabled={isLocked}>
        Laas still-opsaetning
      </button>

      <button
        type="button"
        class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
        on:click={goBack}>
        Tilbage til data
      </button>
    </div>

    {#if recordings.length > 0}
      <div class="rounded-xl border border-slate-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-100 text-slate-700">
            <tr>
              <th class="text-left px-3 py-2">Optagelse</th>
              <th class="text-left px-3 py-2">Samples</th>
              <th class="text-left px-3 py-2">Handling</th>
            </tr>
          </thead>
          <tbody>
            {#each recordings as recording, index (recording.ID)}
              <tr class="border-t border-slate-200">
                <td class="px-3 py-2">Still #{index + 1}</td>
                <td class="px-3 py-2">{recording.samples.length}</td>
                <td class="px-3 py-2">
                  <button
                    type="button"
                    class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
                    on:click={() => removeRecording(recording.ID)}
                    disabled={isLocked}>
                    Slet
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</main>
