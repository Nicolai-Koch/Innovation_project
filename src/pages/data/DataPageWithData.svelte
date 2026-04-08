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
  <NewGestureButton />
</div>
