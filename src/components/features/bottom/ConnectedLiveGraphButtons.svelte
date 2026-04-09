<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { tr } from '../../../i18n';
  import { stores } from '../../../lib/stores/Stores';
  import StandardButton from '../../ui/buttons/StandardButton.svelte';

  const devices = stores.getDevices();

  export let onOutputConnectButtonClicked: () => void;
  export let showOutputControls = true;

  const model = stores.getClassifier().getModel();
</script>

<!-- Keep the live graph controls minimal; disconnect lives in the settings popup. -->
<div class="flex flex-row mr-4">
  {#if showOutputControls && ($model.hasModel || $model.isTraining || $devices.isOutputConnected)}
    {#if !$devices.isOutputAssigned}
      <StandardButton medium onClick={onOutputConnectButtonClicked}>
        {$tr('menu.model.connectOutputButton')}
      </StandardButton>
    {/if}
  {/if}
</div>
