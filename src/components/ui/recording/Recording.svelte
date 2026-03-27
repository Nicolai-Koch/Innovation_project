<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { fade } from 'svelte/transition';
  import { t } from '../../../i18n';
  import type { GestureID } from '../../../lib/domain/stores/gesture/Gesture';
  import { stores } from '../../../lib/stores/Stores';
  import GestureDot from './../GestureDot.svelte';
  import RecordingGraph from '../../features/graphs/recording/RecordingGraph.svelte';
  import type { RecordingData } from '../../../lib/domain/RecordingData';
  import Tooltip from './../Tooltip.svelte';
  import RecordingFingerprint from './RecordingFingerprint.svelte';
  import { Feature, hasFeature } from '../../../lib/FeatureToggles';
  import RecordingDialog from './RecordingDialog.svelte';

  // get recording from mother prop
  export let recording: RecordingData;
  export let gestureId: GestureID;
  export let onDelete: (recording: RecordingData) => void;
  export let dot: { gesture: GestureID; color: string } | undefined = undefined;
  export let enableFingerprint: boolean;

  $: dotGesture = dot?.gesture
    ? stores.getGestures().getGesture(dot?.gesture)
    : undefined;

  $: gesture = stores.getGestures().getGesture(gestureId);
  let hide = false;
  let showDialog = false;

  // Method for propagating deletion of recording
  function deleteClicked() {
    if (hide) {
      return;
    }

    hide = true;
    setTimeout(() => {
      hide = false;
      onDelete(recording);
    }, 450);
  }

  function openDialog() {
    if (!hasFeature(Feature.DIALOG_RECORDINGS)) {
      return;
    }
    showDialog = true;
  }

  function closeDialog() {
    showDialog = false;
  }

  function dialogDelete() {
    // close and propagate delete
    showDialog = false;
    deleteClicked();
  }

  $: shouldDisplayFingerprint = enableFingerprint && hasFeature(Feature.FINGERPRINT);
</script>

<div
  class="h-28 w-50 pr-3 pt-1 relative rounded-md cursor-pointer"
  class:cursor-pointer={hasFeature(Feature.DIALOG_RECORDINGS)}
  class:w-40={!shouldDisplayFingerprint}
  class:w-50={shouldDisplayFingerprint}
  on:click={openDialog}>
  {#if dotGesture !== undefined}
    <div
      class="absolute px-1 py-0.5 z-3 right-1 top-2"
      class:right-1={!shouldDisplayFingerprint}
      class:right-10={shouldDisplayFingerprint}>
      <GestureDot gesture={dotGesture} />
    </div>
  {/if}
  {#if hide}
    <div
      transition:fade
      class="absolute h-26 bg-white"
      class:w-40={!shouldDisplayFingerprint}
      class:w-50={shouldDisplayFingerprint} />
  {:else}
    <div
      transition:fade
      class="absolute h-26 bg-white rounded-md"
      class:w-40={!shouldDisplayFingerprint}
      class:w-50={shouldDisplayFingerprint}>
      <div class="w-40 h-26">
        <RecordingGraph {recording} />
      </div>
      {#if shouldDisplayFingerprint}
        <div class="absolute top-0 left-40 h-24.5 w-10 overflow-hidden">
          <RecordingFingerprint {recording} gestureName={$gesture.name} />
        </div>
      {/if}
    </div>
  {/if}
  <Tooltip title={$t('content.data.tooltip.remove')} offset={{ x: -26, y: -50 }}>
    <button
      class="absolute -left-1 top-0 z-20 outline-none w-6 h-6 flex items-center justify-center"
      on:click|stopPropagation={deleteClicked}
      aria-label={$t('content.data.tooltip.remove')}>
      <div class="relative w-5 h-5">
        <i class="z-1 absolute fas fa-circle fa-lg text-white" />
        <i
          class="z-2 absolute far fa-times-circle fa-lg transition
									ease text-light-800 hover:text-black" />
      </div>
    </button>
  </Tooltip>

  {#if showDialog}
    <RecordingDialog
      {recording}
      gestureName={$gesture.name}
      {enableFingerprint}
      on:close={closeDialog}
      on:delete={dialogDelete} />
  {/if}
</div>
