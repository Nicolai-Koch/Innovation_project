<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { get } from 'svelte/store';
  import {
    alertUser,
    buttonPressed,
    areActionsAllowed,
    microbitInteraction,
    MicrobitInteractions,
    chosenGesture,
  } from '../../../lib/stores/uiStore';
  import Recording from '../../ui/recording/Recording.svelte';
  import { t } from '../../../i18n';
  import GestureCard from '../../ui/Card.svelte';
  import StaticConfiguration from '../../../StaticConfiguration';
  import Gesture from '../../../lib/domain/stores/gesture/Gesture';
  import { stores } from '../../../lib/stores/Stores';
  import type { RecordingData } from '../../../lib/domain/RecordingData';
  import { startRecording } from '../../../lib/utils/Recording';
  import GestureDot from '../../ui/GestureDot.svelte';
  import StandardButton from '../../ui/buttons/StandardButton.svelte';
  import { Feature, getFeature } from '../../../lib/FeatureToggles';

  export let onNoMicrobitSelect: () => void;
  export let gesture: Gesture;
  export let challengeNumber: number | undefined = undefined;
  const devices = stores.getDevices();
  const gestures = stores.getGestures();

  const defaultNewName = $t('content.data.classPlaceholderNewClass');
  const recordingDuration = getFeature<number>(Feature.RECORDING_DURATION);
  const enableFingerprint = stores.getEnableFingerprint();

  let isThisRecording = false;
  let showDropdown = false;

  const predefinedGestures = [
    { name: 'Hoppe', icon: 'fas fa-arrow-up' },
    { name: 'Slå', icon: 'fas fa-fist-raised' },
    { name: 'Drejer', icon: 'fas fa-circle-notch' },
    { name: 'Vender', icon: 'fas fa-arrows-alt-h' },
    { name: 'Bukke', icon: 'fas fa-person' },
    { name: 'Løbe', icon: 'fas fa-person-running' },
  ];

  const nameBind = gesture.bindName();

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

  // Blend the class color with white to keep row backgrounds soft/pastel.
  function getPastelBackground(hexColor: string): string {
    return hexToRgba(hexColor, 0.2) ?? fallbackRowBackgroundColor;
  }

  // When title is clicked. Remove name
  function titleClicked(): void {
    if (gesture.getName() === defaultNewName) {
      gesture.setName('');
    }
    showDropdown = !showDropdown;
  }

  function selectPredefinedGesture(gestureName: string): void {
    gesture.setName(gestureName);
    showDropdown = false;
  }

  function removeClicked(): void {
    if (!areActionsAllowed(false)) {
      return;
    }

    if (
      !window.confirm($t('alert.deleteGestureConfirm') + '"' + gesture.getName() + '"?')
    ) {
      return;
    }

    setTimeout(() => {
      gestures.removeGesture(gesture.getId());
    }, 450);
  }

  // method for recording data point for that specific gesture
  function recordClicked(e?: Event): void {
    e?.stopPropagation();
    if (!areActionsAllowed()) {
      return;
    }
    isThisRecording = true;
    startRecording(recording => {
      isThisRecording = false;
      gesture.addRecording(recording);
    });
  }

  // Single-step action: select this class (if needed) and start recording.
  function recordFromCardClicked(e?: Event): void {
    e?.stopPropagation();
    if (!$devices.isInputConnected) {
      chosenGesture.update(gesture => {
        gesture = null;
        return gesture;
      });
      onNoMicrobitSelect();
      return;
    }

    chosenGesture.update(() => gesture);
    recordClicked();
  }

  // Delete recording from recordings array
  function deleteRecording(recording: RecordingData) {
    if (!areActionsAllowed(false)) {
      return;
    }
    gesture.removeRecording(recording.ID);
  }

  // Selecting this gesture for recording. Updates settings accordingly
  // If gesture is already selected, the selection is removed.
  // If bluetooth is not connected, open connection prompt by calling callback
  function selectClicked(): void {
    if (!$devices.isInputConnected) {
      chosenGesture.update(gesture => {
        gesture = null;
        return gesture;
      });
      onNoMicrobitSelect();
      return;
    }
    chosenGesture.update(chosen => {
      if (chosen === gesture) {
        chosen = null;
      } else {
        chosen = gesture;
      }
      return chosen;
    });
  }

  // When microbit buttons are pressed, this is called
  // Assess whether settings match with button-clicked.
  // If so, the gesture calls the recording function.
  function triggerButtonsClicked(buttons: { buttonA: 0 | 1; buttonB: 0 | 1 }): void {
    if ($chosenGesture !== gesture) {
      return;
    }
    const triggerButton = get(microbitInteraction);
    if (
      triggerButton === MicrobitInteractions.AB ||
      (buttons.buttonA && triggerButton === MicrobitInteractions.A) ||
      (buttons.buttonB && triggerButton === MicrobitInteractions.B)
    )
      recordClicked();
  }

  function onTitleKeypress(event: KeyboardEvent) {
    if (event.code === 'Enter') {
      event.preventDefault();
      if (event.target instanceof HTMLElement) {
        event.target.blur();
      }
      return true;
    }

    if (event.code === 'Escape') {
      event.preventDefault();
      showDropdown = false;
      if (event.target instanceof HTMLElement) {
        event.target.blur();
      }
      return true;
    }

    if ($nameBind.length >= StaticConfiguration.gestureNameMaxLength) {
      event.preventDefault();
      alertUser(
        $t('alert.data.classNameLengthAlert', {
          values: {
            maxLen: StaticConfiguration.gestureNameMaxLength,
          },
        }),
      );
      return false;
    }
  }

  // Make function depend on buttonsPressed store.
  let declaring = true;
  $: {
    if (!declaring) {
      // Do not call when component is mounted
      triggerButtonsClicked($buttonPressed);
    } else {
      declaring = false;
    }
  }
</script>

<div class="flex-row flex">
  <div
    class="items-center flex relative rounded-xl px-2 py-2"
    style="background-color: {getPastelBackground($gesture.color)};">
    <!-- Recordingbar to show recording-progress for this specific gesture row -->
    <div class="absolute left-0 top-0 w-full h-1.5 pointer-events-none z-10">
      <div
        class="bg-red-600 h-1.5 rounded-full"
        style={isThisRecording
          ? `transition: ${(recordingDuration / 1000).toString()}s linear; width: 97%;`
          : 'width:0;'} />
    </div>

    <!-- Title of gesture-->
    <GestureCard mr small>
      <div class="top-2 left-3 absolute flex flex-row justify-center items-center gap-4">
        <GestureDot {gesture} disableTooltip={true} editable={true} />
      </div>
      <div class="flex items-center justify-center relative p-2 w-50 h-30">
        {#if challengeNumber !== undefined}
          <div class="absolute top-3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold z-10 pointer-events-none">
            #{challengeNumber}
          </div>
        {/if}
        <div class="w-40 text-center font-semibold transition ease rounded-xl border border-gray-300 border-solid hover:bg-gray-100 relative">
          <h3
            contenteditable
            bind:innerText={$nameBind}
            on:click={titleClicked}
            on:keypress={onTitleKeypress} />
          
          {#if showDropdown}
            <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
              {#each predefinedGestures as predefined (predefined.name)}
                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 transition ease text-left border-b border-gray-200 last:border-b-0"
                  on:click={() => selectPredefinedGesture(predefined.name)}>
                  <i class="{predefined.icon} text-primarytext" />
                  <span class="text-sm">{predefined.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <button class="absolute right-2 top-2 outline-none">
          <i
            class="far fa-times-circle fa-lg text-light-800 hover:text-black transition ease"
            on:click={removeClicked} />
        </button>
      </div>
    </GestureCard>

    <GestureCard small mr elevated={$chosenGesture === gesture}>
      <div class="text-center w-35 cursor-pointer" on:click={selectClicked}>
        <div class="w-full text-center">
          <i class="w-full h-full m-0 mt-4 p-2 fas fa-plus fa-2x text-primarytext" />
        </div>
        <StandardButton
          onClick={recordFromCardClicked}
          small
          shadows={false}
          outlined
          fillOnHover>Optag data</StandardButton>
      </div>
    </GestureCard>
    <!-- Show recording for each recording -->
    {#if $gesture.recordings.length > 0}
      <GestureCard small>
        <div class="flex p-2 h-30">
          {#each $gesture.recordings as recording (String($gesture.ID) + String(recording.ID))}
            <Recording
              enableFingerprint={$enableFingerprint}
              {recording}
              gestureId={$gesture.ID}
              onDelete={deleteRecording} />
          {/each}
        </div>
      </GestureCard>
    {:else if $chosenGesture === gesture}
      <GestureCard small>
        <div class="h-30 w-60 flex items-center px-4">
          <p class="text-center text-sm leading-tight">
            Tryk på Jacdac-knappen for at optage denne bevægelse.
          </p>
        </div>
      </GestureCard>
    {/if}
  </div>
</div>
