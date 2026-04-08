<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { t } from './../../../i18n';
  import { activeChallengeNumber } from '../../../lib/stores/BoardGameChallengeStore';
  import { stores } from '../../../lib/stores/Stores';
  import OutputGesture from '../../../components/features/model/ModelGesture.svelte';

  const devices = stores.getDevices();
  const gestures = stores.getGestures();
  const bestPrediction = gestures.getBestPrediction();
  // Bool flags to know whether output microbit popup should be show
  let hasClosedPopup = false;
  let timerSecondsLeft = 5;
  let timerRunning = false;
  let timerFinished = false;
  let timerInterval: ReturnType<typeof setInterval> | undefined;
  let previousChallengeNumber: number | null = null;

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

<div>
  <div class={`mb-2 rounded-xl border px-3 py-2 text-center text-sm font-semibold ${gameFeedback.classes}`}>
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

  <div
    class="mb-2 grid h-8 items-end text-sm font-bold"
    style="grid-template-columns: 7rem 19rem 12rem 10rem;">
    <p class="text-center">Vælg udfordring</p>
    <p class="text-center">Robot gaetter</p>
    <p class="text-center">LED output</p>
    <p class="text-center">Lyd</p>
  </div>

  <div class="pl-1">
    <!-- Display all gestures and their output capabilities -->
    {#each $gestures as gestureData (gestureData.ID)}
      {@const gesture = gestures.getGesture(gestureData.ID)}
      <OutputGesture variant="stack" {gesture} {onUserInteraction} />
    {/each}
  </div>
  {#if !$devices.isOutputConnected && !hasClosedPopup && hasInteracted}
    <div transition:fade class="grid grid-cols-5 absolute bottom-5 w-full min-w-729px">
      <div
        class="flex relative col-start-2 rounded-lg col-end-5 h-35"
        style="background-color:rgba(231, 229, 228, 0.85)">
        <div class="m-4 mr-2 w-3/4">
          <p class="text-2xl font-bold">
            {$t('content.model.output.popup.header')}
          </p>
          <p>
            {$t('content.model.output.popup.body')}
          </p>
        </div>
        <div class="text-center ml-0 mb-2 mt-8">
          <img
            class="m-auto arrow-filter-color"
            src="/imgs/down_arrow.svg"
            alt="down arrow icon"
            width="80px" />
        </div>
        <div class="absolute right-2 top-2 svelte-1rnkjvh">
          <button
            class="hover:bg-gray-100 rounded outline-transparent w-8 svelte-1rnkjvh"
            on:click={() => {
              hasClosedPopup = true;
            }}>
            <i
              class="fas fa-plus text-lg text-gray-600 hover:text-gray-800 duration-75 svelte-1rnkjvh"
              style="transform: rotate(45deg);" />
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
