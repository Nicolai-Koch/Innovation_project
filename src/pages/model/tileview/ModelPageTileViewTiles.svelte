<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { areActionsAllowed, buttonPressed } from '../../../lib/stores/uiStore';
  import { activeChallengeNumber } from '../../../lib/stores/BoardGameChallengeStore';
  import Microbits from '../../../lib/microbit-interfacing/Microbits';
  import MediaQuery from '../../../components/layout/MediaQuery.svelte';
  import { stores } from '../../../lib/stores/Stores';
  import OutputGesture from '../../../components/features/model/ModelGesture.svelte';
  import { Feature, getFeature } from '../../../lib/FeatureToggles';

  const devices = stores.getDevices();
  const gestures = stores.getGestures();
  const bestPrediction = gestures.getBestPrediction();
  let timerSecondsLeft = 5;
  let timerRunning = false;
  let timerFinished = false;
  let timerInterval: ReturnType<typeof setInterval> | undefined;
  let previousChallengeNumber: number | null = null;
  // In case of manual classification, variables for evaluation
  let recordingTime = 0;
  // let lastRecording;

  // Bool flags to know whether output microbit popup should be show
  let hasInteracted = false;

  function onUserInteraction(): void {
    hasInteracted = true;
  }

  function clearChallengeTimer(): void {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = undefined;
    }
  }

  function startChallengeTimer(): void {
    clearChallengeTimer();
    timerSecondsLeft = 5;
    timerFinished = false;
    timerRunning = true;

    timerInterval = setInterval(() => {
      timerSecondsLeft -= 1;
      if (timerSecondsLeft <= 0) {
        clearChallengeTimer();
        timerSecondsLeft = 0;
        timerRunning = false;
        timerFinished = true;
      }
    }, 1000);
  }

  function retryChallenge(): void {
    if (!challengeGesture) return;
    startChallengeTimer();
  }

  /**
   * Classify based on button click
   */
  // method for recording gesture for that specific gesture
  function classifyClicked() {
    if (!areActionsAllowed()) return;

    $devices.isRecording = true;
    // lastRecording = undefined;

    // Get duration
    const duration = getFeature<number>(Feature.RECORDING_DURATION);

    // Loading interval
    const loadingInterval = setInterval(() => {
      recordingTime++;
    }, duration / 30);

    // TODO: Clean this up to avoid 'firstMount' hack
    // Once duration is over (1000ms default), stop recording
    setTimeout(() => {
      clearInterval(loadingInterval);
      // lastRecording = getPrevData();
      $devices.isRecording = false;
      recordingTime = 0;
      // classify();
    }, duration);
  }

  // When microbit buttons are pressed, this is called
  // Assess whether settings match with button-clicked.
  // If so, the gesture calls the recording function.
  function triggerButtonsClicked(buttons: { buttonA: 0 | 1; buttonB: 0 | 1 }) {
    if (firstMount) {
      return;
    }

    let shouldClassify: boolean = buttons.buttonA === 1 || buttons.buttonB === 1;

    if (shouldClassify) {
      classifyClicked();
    }
  }

  let firstMount = true;
  onMount(() => {
    firstMount = false;
    Microbits.resetIOPins();
  });

  $: triggerButtonsClicked($buttonPressed);

  $: challengeGesture =
    $activeChallengeNumber === null
      ? undefined
      : $gestures[$activeChallengeNumber - 1];

  $: guessedGesture =
    $bestPrediction === undefined
      ? undefined
      : $gestures.find(gesture => gesture.ID === $bestPrediction.getId());

  $: guessedConfident = guessedGesture?.confidence?.isConfident ?? false;

  $: guessedCorrect =
    !!challengeGesture &&
    !!guessedGesture &&
    guessedConfident &&
    guessedGesture.ID === challengeGesture.ID;

  $: {
    if ($activeChallengeNumber !== previousChallengeNumber) {
      previousChallengeNumber = $activeChallengeNumber;
      if ($activeChallengeNumber === null) {
        clearChallengeTimer();
        timerRunning = false;
        timerFinished = false;
        timerSecondsLeft = 5;
      } else {
        startChallengeTimer();
      }
    }
  }

  $: {
    if (guessedCorrect && timerRunning) {
      clearChallengeTimer();
      timerRunning = false;
      timerFinished = false;
    }
  }

  $: gameFeedback = (() => {
    if (!challengeGesture) {
      return {
        text: 'Vaelg udfordring',
        classes: 'bg-blue-50 text-blue-800 border-blue-200',
        canRetry: false,
      };
    }

    if (guessedCorrect) {
      return {
        text: '✅ You did it!',
        classes: 'bg-green-50 text-green-800 border-green-200',
        canRetry: false,
      };
    }

    if (timerRunning) {
      return {
        text: `Go! ${timerSecondsLeft}s`,
        classes: 'bg-blue-50 text-blue-800 border-blue-200',
        canRetry: false,
      };
    }

    if (timerFinished) {
      return {
        text: '❌ Try again',
        classes: 'bg-red-50 text-red-800 border-red-200',
        canRetry: true,
      };
    }

    return {
      text: 'Tryk knappen',
      classes: 'bg-blue-50 text-blue-800 border-blue-200',
      canRetry: false,
    };
  })();

  onDestroy(() => {
    clearChallengeTimer();
  });
</script>

<div class={`mb-3 rounded-xl border px-3 py-2 text-center text-sm font-semibold ${gameFeedback.classes}`}>
  <div class="flex items-center justify-center gap-3">
    <span>{gameFeedback.text}</span>
    {#if gameFeedback.canRetry}
      <button
        type="button"
        class="rounded border border-current px-2 py-1 text-xs font-semibold"
        on:click={retryChallenge}>
        Proev igen
      </button>
    {/if}
  </div>
</div>

<MediaQuery query="(max-width: 1000px)" let:matches>
  {#if matches}
    <div class="grid grid-cols-3 gap-4">
      {#each $gestures as gestureData (gestureData.ID)}
        {@const gesture = gestures.getGesture(gestureData.ID)}
        <OutputGesture {gesture} {onUserInteraction} variant={'tile'} />
      {/each}
    </div>
  {/if}
</MediaQuery>
<MediaQuery query="(min-width: 1000px) and (max-width: 1367px)" let:matches>
  {#if matches}
    <div class="grid grid-cols-4 gap-4">
      {#each $gestures as gestureData (gestureData.ID)}
        {@const gesture = gestures.getGesture(gestureData.ID)}
        <OutputGesture {gesture} {onUserInteraction} variant={'tile'} />
      {/each}
    </div>
  {/if}
</MediaQuery>
<MediaQuery query="(min-width: 1367px)" let:matches>
  {#if matches}
    <div class="grid grid-cols-5 gap-4">
      {#each $gestures as gestureData (gestureData.ID)}
        {@const gesture = gestures.getGesture(gestureData.ID)}
        <OutputGesture {gesture} {onUserInteraction} variant={'tile'} />
      {/each}
    </div>
  {/if}
</MediaQuery>
