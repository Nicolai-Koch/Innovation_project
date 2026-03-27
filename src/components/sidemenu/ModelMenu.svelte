<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { t } from '../../i18n';
  import { activeChallenge, activeChallengeNumber } from '../../lib/stores/BoardGameChallengeStore';
  import { stores } from '../../lib/stores/Stores';

  const gestures = stores.getGestures();
  const devices = stores.getDevices();
  const confidences = stores.getConfidences();

  const model = stores.getClassifier().getModel();
  let frozenSuccessByChallenge: Record<number, number> = {};

  $: activeGesture =
    $activeChallengeNumber !== null && $activeChallengeNumber > 0
      ? $gestures[$activeChallengeNumber - 1]
      : undefined;

  $: activeGestureId = activeGesture ? activeGesture.ID : undefined;

  $: confidence =
    $devices.isInputReady && activeGestureId !== undefined && $confidences.has(activeGestureId)
      ? ($confidences.get(activeGestureId) ?? 0)
      : 0;
  $: safeConfidence = isNaN(confidence) ? 0 : confidence;

  $: activeChallengeKey = $activeChallenge?.challengeNumber;

  $: {
    if (
      activeChallengeKey !== undefined &&
      activeGesture &&
      $devices.isInputReady &&
      safeConfidence > activeGesture.confidence.requiredConfidence
    ) {
      const prev = frozenSuccessByChallenge[activeChallengeKey] ?? 0;
      if (safeConfidence > prev) {
        frozenSuccessByChallenge = {
          ...frozenSuccessByChallenge,
          [activeChallengeKey]: safeConfidence,
        };
      }
    }
  }

  $: frozenSuccessConfidence =
    activeChallengeKey !== undefined ? frozenSuccessByChallenge[activeChallengeKey] : undefined;

  $: displayedConfidence = frozenSuccessConfidence ?? safeConfidence;

  $: confidenceLabel = Math.round(displayedConfidence * 100).toString() + '%';
  $: predictionLabel = (() => {
    if (!$gestures.length) {
      return $t('menu.model.noModel');
    }
    if (!$devices.isInputReady) {
      return $t('menu.model.connectInputMicrobit');
    }
    if (!$activeChallenge) {
      return 'Vælg udfordring';
    }
    if (!activeGesture) {
      return `Udfordring #${$activeChallenge.challengeNumber} findes ikke`;
    }
    return activeGesture.name;
  })();

  $: challengeStatus = (() => {
    if (!$activeChallenge) {
      return {
        text: 'Vælg en aktiv udfordring på Model-siden',
        isSuccess: false,
      };
    }

    if (!activeGesture) {
      return {
        text: `Udfordring #${$activeChallenge.challengeNumber}: ingen klasse med dette nummer`,
        isSuccess: false,
      };
    }

    if (!$devices.isInputReady) {
      return {
        text: 'Tilkobl micro:bit for at starte udfordringen',
        isSuccess: false,
      };
    }

    if (frozenSuccessConfidence !== undefined) {
      return {
        text: `Udfordring #${$activeChallenge.challengeNumber}: Rigtigt (låst)` ,
        isSuccess: true,
      };
    }

    if (safeConfidence > activeGesture.confidence.requiredConfidence) {
      return {
        text: `Udfordring #${$activeChallenge.challengeNumber}: Rigtigt!`,
        isSuccess: true,
      };
    }

    return {
      text: `Udfordring #${$activeChallenge.challengeNumber}: Forkert bevægelse, prøv igen`,
      isSuccess: false,
    };
  })();
</script>

<div class="w-full text-center justify-center pt-5">
  {#if !$model.hasModel}
    <div
      class="h-34 w-34 m-auto mb-8 border-2 border-white border-opacity-30 rounded-lg border-dashed font-bold text-warm-gray-300">
      <div class="flex h-full">
        <div class="m-auto">
          {$t('menu.model.noModel')}
        </div>
      </div>
    </div>
  {:else}
    <div
      class="grid break-words mr-auto ml-auto w-3/4 h-70px border-2 rounded-lg border-solid text-center align-center content-center">
      <p
        class="w-full max-w-[100%] text-2xl break-all"
        class:text-2xl={$devices.isInputReady}
        class:text-md={!$devices.isInputReady}>
        {predictionLabel}
      </p>
    </div>
    <p class="text-4xl ml-5 mt-4 pb-4">
      {confidenceLabel}
    </p>
    <p
      class="text-sm px-4 pb-2 font-semibold"
      class:text-green-700={challengeStatus.isSuccess}
      class:text-red-700={!challengeStatus.isSuccess}>
      {challengeStatus.text}
    </p>
  {/if}
</div>
