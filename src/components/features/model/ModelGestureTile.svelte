<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<style>
  input[type='range'][orient='vertical'] {
    writing-mode: bt-lr; /* IE */
    -webkit-appearance: slider-vertical; /* WebKit */
    appearance: slider-vertical;
    width: 20px;
    background: #13bba4;
  }
</style>

<script lang="ts">
  // IMPORT AND DEFAULTS
  import { t } from '../../../i18n';
  import type Gesture from '../../../lib/domain/stores/gesture/Gesture';
  import { navigate, Paths } from '../../../router/Router';
  import { chosenGesture } from '../../../lib/stores/uiStore';
  import { requestExtraRecordingForGesture } from '../../../lib/stores/ExtraRecordingStore';
  import Card from '../../ui/Card.svelte';
  import GestureDot from '../../ui/GestureDot.svelte';
  import Information from '../../ui/information/Information.svelte';
  import ModelChallengeSelect from './ModelChallengeSelect.svelte';

  // Variables for component
  export let gesture: Gesture;
  export let challengeNumber: number = 0;

  let sliderValue = $gesture.confidence.requiredConfidence * 100;
  $: {
    gesture.getConfidence().setRequiredConfidence(sliderValue / 100);
  }

  $: active =
    $gesture.confidence.currentConfidence > $gesture.confidence.requiredConfidence;

  const noTypeCheckNonStandardOrientProp = (orient?: 'vertical' | 'horizontal'): any => ({
    orient,
  });

  const addExtraRecording = () => {
    requestExtraRecordingForGesture(gesture.getId(), gesture.getRecordings().length + 1);
    chosenGesture.set(gesture);
    navigate(Paths.DATA);
  };

  const fallbackRowBackgroundColor = 'rgba(240, 240, 240, 0.85)';

  function hexToRgba(hexColor: string, alpha: number): string | undefined {
    const hex = hexColor.trim().replace('#', '');
    const isValid = /^[0-9a-fA-F]{6}$/.test(hex);
    if (!isValid) {
      return undefined;
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getPastelBackground(hexColor: string): string {
    return hexToRgba(hexColor, 0.2) ?? fallbackRowBackgroundColor;
  }
</script>

<div data-challenge-number={challengeNumber}>
  <Card>
    <div
      class="items-center h-full my-auto justify-between flex gap-2 p-2 rounded-xl"
      style="background-color: {getPastelBackground($gesture.color)};">
      <ModelChallengeSelect {gesture} />
      <div class="mr-2 flex flex-col items-center">
        <div
          class="w-36 text-center font-semibold rounded-xl
                      px-1 py-1 border border-gray-300
                      border-dashed break-words bg-white">
          <div class="flex justify-center mb-1">
            <GestureDot {gesture} editable={true} />
          </div>
          <h3>{$gesture.name}</h3>
        </div>
        <button
          type="button"
          class="mt-2 rounded border border-primaryborder px-2 py-1 text-xs font-semibold hover:bg-white"
          on:click={addExtraRecording}>
          Tilføj 1 optagelse
        </button>
      </div>

    <!-- METER -->
    <div class="flex">
      <input
        class="h-25 rotate-90 accent-primary"
        type="range"
        {...noTypeCheckNonStandardOrientProp('vertical')}
        name=""
        min="10"
        max="90"
        id=""
        bind:value={sliderValue} />
      <div class="w-4 h-25 relative">
        <div
          class="w-4 h-full absolute rounded border border-solid border-gray-400 overflow-hidden">
          <div
            class="absolute w-5
            {active ? 'bg-primary' : 'bg-info'}
              z-index: -10"
            style="height: {100 *
              $gesture.confidence.currentConfidence}px; margin-top: {100 -
              100 * $gesture.confidence.currentConfidence}px;" />
          <div
            class="absolute w-5 bg-primary"
            style="height: 1px; margin-top: {6.5 -
              0.068 * $gesture.confidence.requiredConfidence * 100}rem;" />
          <div class="absolute">
            {#each [75, 50, 25] as line}
              <div class="w-5 bg-gray-300 mt-6" style="height: 1px;">
                <p class="absolute text-xs" style="margin-top: -8px; margin-left: 18px;">
                  {line}%
                </p>
              </div>
            {/each}
          </div>
          <div />
        </div>
      </div>
      <div class="relative self-start">
        <Information
          titleText={$t('content.model.classification.helpHeading')}
          bodyText={$t('content.model.classification.helpBody')}
          isLightTheme={false} />
      </div>
    </div>
    </div>
  </Card>
</div>
