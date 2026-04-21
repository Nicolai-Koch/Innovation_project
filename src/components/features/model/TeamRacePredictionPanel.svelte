<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors

  SPDX-License-Identifier: MIT
-->

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import BaseVector from '../../../lib/domain/BaseVector';
  import { ClassifierInput } from '../../../lib/domain/ClassifierInput';
  import { Feature, getFeature } from '../../../lib/FeatureToggles';
  import StaticConfiguration from '../../../StaticConfiguration';
  import { stores } from '../../../lib/stores/Stores';
  import {
    gamePhase,
    GamePhase,
    getCurrentTeamChallengeId,
    getRaceWinner,
    getTeamLiveDataSource,
    getTeamRaceProgress,
    getTeamRaceSequence,
    markTeamChallengeAttemptSuccess,
    raceWinner,
    teamAChallengeState,
    setTeamPredictionConfidences,
    setRaceWinner,
    teamBChallengeState,
    teamAColorId,
    teamARaceProgress,
    teamBColorId,
    teamBRaceProgress,
    teamColorPalette,
    type TeamKey,
  } from '../../../lib/stores/TeamGameStore';

  type PredictionRow = {
    classIndex: number;
    id: number;
    name: string;
    recordings: number;
    color: string;
    confidence: number;
  };

  export let team: TeamKey;

  const classifier = stores.getClassifier();
  const gesturesStore = stores.getGestures();
  const model = classifier.getModel();
  const filters = classifier.getFilters();
  const highlightedAxes = stores.getHighlightedAxes();
  const liveData = getTeamLiveDataSource(team);
  const raceProgressStore = team === 'A' ? teamARaceProgress : teamBRaceProgress;
  const panelPollingInterval = Math.max(StaticConfiguration.pollingPredictionInterval, 120);

  let refreshToken = 0;
  let predictionRows: PredictionRow[] = [];
  let orderedPredictionRows: PredictionRow[] = [];
  let statusText = 'Venter paa start';
  let topPrediction: PredictionRow | undefined;
  let currentTargetClassIndex = 0;
  let activeThreshold = StaticConfiguration.defaultRequiredConfidence;
  let pollingInterval: ReturnType<typeof setInterval> | undefined;
  let predictionInFlight = false;
  let refreshQueued = false;

  $: teamTitle = team === 'A' ? 'Hold A' : 'Hold B';

  $: accentColor = (() => {
    const colorId = team === 'A' ? $teamAColorId : $teamBColorId;
    return (
      teamColorPalette.find(entry => entry.id === colorId)?.hex ??
      (team === 'A' ? '#2563eb' : '#dc2626')
    );
  })();

  function getBufferedData(sampleSize: number) {
    try {
      return liveData
        .getBuffer()
        .getSeries(getFeature<number>(Feature.RECORDING_DURATION), sampleSize);
    } catch {
      if (sampleSize < 8) {
        return [];
      }

      return getBufferedData(
        sampleSize - StaticConfiguration.pollingPredictionSampleSizeSearchStepSize,
      );
    }
  }

  function rebuildOrderedRows() {
    const sequence = getTeamRaceSequence(team);
    orderedPredictionRows = sequence
      .map(classIndex => predictionRows[classIndex])
      .filter((row): row is PredictionRow => !!row);
  }

  function getRowVisualState(classIndex: number) {
    const sequence = getTeamRaceSequence(team);
    const progress = getTeamRaceProgress(team);
    const challengeState = get(team === 'A' ? teamAChallengeState : teamBChallengeState);
    const position = sequence.indexOf(classIndex);

    if (position >= 0 && position < progress) {
      return 'completed';
    }

    if (position === progress && challengeState.status !== 'passed') {
      return 'active';
    }

    return 'idle';
  }

  function ensurePredictionRows() {
    const snapshot = [...get(gesturesStore)].sort((left, right) => left.ID - right.ID);

    if (snapshot.length === 0) {
      predictionRows = [];
      orderedPredictionRows = [];
      return snapshot;
    }

    const previousById = new Map(predictionRows.map(row => [row.id, row]));
    predictionRows = snapshot.map((gesture, index) => {
      const previous = previousById.get(gesture.ID);
      return {
        classIndex: index,
        id: gesture.ID,
        name: gesture.name,
        recordings: gesture.recordings.length,
        color: gesture.color,
        confidence: previous?.confidence ?? 0,
      };
    });

    rebuildOrderedRows();

    return snapshot;
  }

  async function refreshPredictions() {
    if (predictionInFlight) {
      refreshQueued = true;
      return;
    }

    const currentToken = ++refreshToken;
    const snapshot = ensurePredictionRows();
    const sequence = getTeamRaceSequence(team);
    const challengeState = get(team === 'A' ? teamAChallengeState : teamBChallengeState);

    if (snapshot.length === 0) {
      statusText = 'Ingen klasser fundet';
      return;
    }

    const progress = getTeamRaceProgress(team);
    currentTargetClassIndex = sequence[Math.min(progress, sequence.length - 1)] ?? 0;
    activeThreshold = challengeState.threshold;

    if (!$model.isTrained) {
      statusText = 'Model ikke traenet endnu';
      return;
    }

    if (get(gamePhase) !== GamePhase.Playing && get(gamePhase) !== GamePhase.Paused) {
      const winner = get(raceWinner);
      statusText = winner
        ? `Hold ${winner} vandt`
        : 'Afventer holdknap';
      return;
    }

    if (challengeState.status !== 'attempt') {
      setTeamPredictionConfidences(team, {});
      predictionRows = predictionRows.map(row => ({
        ...row,
        confidence: 0,
      }));
      rebuildOrderedRows();
      topPrediction = undefined;

      if (challengeState.status === 'countdown') {
        statusText = `Hold ${team}: Countdown...`;
      } else if (challengeState.status === 'passed') {
        statusText = 'Alle udfordringer klaret';
      } else if (challengeState.status === 'failed') {
        statusText = 'Ikke klaret. Holdknap = prov igen, spilleknap = retrain';
      } else if (challengeState.status === 'awaiting-retrain') {
        statusText = 'Tilfoej optagelse og traen igen paa Traen AI siden';
      } else {
        statusText = 'Tryk holdknap for countdown';
      }
      return;
    }

    try {
      predictionInFlight = true;
      const bufferedData = getBufferedData(StaticConfiguration.pollingPredictionSampleSize);
      if (bufferedData.length === 0) {
        statusText = 'Venter paa nok live-data';
        return;
      }

      const classifierInput = ClassifierInput.getInputForAxes(
        bufferedData.map(entry => entry.value),
        get(highlightedAxes),
      );

      const filteredInput = new BaseVector(classifierInput.getInput(filters));
      const predictions = await model.predict(filteredInput);

      if (currentToken !== refreshToken) {
        return;
      }

      predictionRows = predictionRows.map((row, index) => ({
        ...row,
        confidence: predictions[index] ?? row.confidence,
      }));
      setTeamPredictionConfidences(
        team,
        Object.fromEntries(predictionRows.map(row => [row.id, row.confidence])),
      );
      rebuildOrderedRows();

      topPrediction = [...predictionRows].sort(
        (left, right) => right.confidence - left.confidence,
      )[0];

      const winner = getRaceWinner();
      if (winner && winner !== team) {
        statusText = `Hold ${winner} vandt`;
        return;
      }

      const targetClassId = getCurrentTeamChallengeId(team);
      const targetClassIndex = targetClassId !== null ? targetClassId - 1 : null;
      const targetConfidence =
        targetClassIndex !== null ? predictionRows[targetClassIndex]?.confidence ?? 0 : 0;

      if (targetClassIndex !== null && targetConfidence >= activeThreshold) {
        markTeamChallengeAttemptSuccess(team);
        statusText = `Klaret! ${Math.round(targetConfidence * 100)}%`; 
        return;
      }

      const currentClassName = predictionRows[currentTargetClassIndex]?.name ?? '-';
      statusText = `Maal klasse ${currentClassName} (>= ${Math.round(activeThreshold * 100)}%)`;
    } catch {
      if (currentToken !== refreshToken) {
        return;
      }

      statusText = 'Venter paa nok live-data';
    } finally {
      predictionInFlight = false;

      if (refreshQueued) {
        refreshQueued = false;
        queueMicrotask(() => void refreshPredictions());
      }
    }
  }

  function startPredictionPolling() {
    if (pollingInterval) {
      return;
    }

    pollingInterval = setInterval(() => {
      if (get(gamePhase) === GamePhase.Playing || get(gamePhase) === GamePhase.Paused) {
        void refreshPredictions();
      }
    }, panelPollingInterval);
  }

  function stopPredictionPolling() {
    if (!pollingInterval) {
      return;
    }

    clearInterval(pollingInterval);
    pollingInterval = undefined;
  }

  let unsubscribers: Array<() => void> = [];

  onMount(() => {
    void refreshPredictions();
    startPredictionPolling();

    unsubscribers = [
      highlightedAxes.subscribe(() => void refreshPredictions()),
      gesturesStore.subscribe(() => void refreshPredictions()),
      gamePhase.subscribe(() => {
        if (get(gamePhase) === GamePhase.Playing || get(gamePhase) === GamePhase.Paused) {
          startPredictionPolling();
        } else {
          stopPredictionPolling();
        }
        void refreshPredictions();
      }),
      raceProgressStore.subscribe(() => void refreshPredictions()),
      raceWinner.subscribe(() => void refreshPredictions()),
      (team === 'A' ? teamAChallengeState : teamBChallengeState).subscribe(() => void refreshPredictions()),
      model.subscribe(() => void refreshPredictions()),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      unsubscribers = [];
    };
  });

  onDestroy(() => {
    refreshToken += 1;
    stopPredictionPolling();
    refreshQueued = false;
  });
</script>

<section
  class="rounded-2xl border bg-white/95 p-4 shadow-sm"
  style={`border-color: ${accentColor}40;`}>
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{teamTitle}</p>
      <h2 class="mt-1 text-2xl font-bold text-slate-900">{statusText}</h2>
      <p class="mt-1 text-sm text-slate-600">Maales kun paa dette holds live-data.</p>
    </div>
    <div class="h-4 w-4 rounded-full" style={`background-color: ${accentColor};`} />
  </div>

  {#if predictionRows.length === 0}
    <div class="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
      Ingen klasser fundet endnu.
    </div>
  {:else}
    <div class="mt-4 space-y-3">
      <div class="rounded-xl bg-slate-50 px-4 py-3">
        <p class="text-sm font-semibold text-slate-800">Aktuel top</p>
        <p class="text-2xl font-bold text-slate-900">{topPrediction?.name ?? 'Ingen endnu'}</p>
        <p class="text-sm text-slate-600">
          {topPrediction
            ? `${Math.round(topPrediction.confidence * 100)}% sikker`
            : 'Venter paa prediction'}
        </p>
      </div>

      {#each orderedPredictionRows as row (row.id)}
        {@const rowState = getRowVisualState(row.classIndex)}
        <div
          class="rounded-xl border px-4 py-3"
          class:border-green-300={rowState === 'completed'}
          class:bg-green-50={rowState === 'completed'}
          class:border-amber-400={rowState === 'active'}
          class:bg-amber-50={rowState === 'active'}
          class:border-slate-200={rowState === 'idle'}
          class:bg-white={rowState === 'idle'}>
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <div
                  class="h-2.5 w-2.5 rounded-full"
                  class:bg-green-600={rowState === 'completed'}
                  class:bg-amber-500={rowState === 'active'}
                  class:bg-slate-400={rowState === 'idle'} />
                <h3 class="truncate font-semibold text-slate-900">{row.name}</h3>
              </div>
              <p class="mt-1 text-xs text-slate-500">
                {row.recordings} optagelser
                {#if rowState === 'active'}
                  . Maal: {Math.round(activeThreshold * 100)}%+
                {:else if rowState === 'completed'}
                  . Klaret
                {/if}
              </p>
            </div>

            <div class="text-right">
              <p class="text-base font-bold text-slate-800">{Math.round(row.confidence * 100)}%</p>
              <p class="text-[11px] text-slate-500">sandsynlighed</p>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>
