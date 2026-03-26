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

  let isConnectionDialogOpen = false;
  const gestures = stores.getGestures();
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
    <Gesture
      gesture={gestures.getGesture(gesture.ID)}
      onNoMicrobitSelect={() => (isConnectionDialogOpen = true)} />
  {/each}
  <NewGestureButton />
</div>
