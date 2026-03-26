<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import StandardDialog from '../../ui/dialogs/StandardDialog.svelte';
  import BluetoothConnectDialog from './bluetooth/BluetoothConnectDialog.svelte';
  import StartDialog from './StartDialog.svelte';
  import {
    ConnectDialogStates,
    connectionDialogState,
  } from '../../../lib/stores/connectDialogStore';
  import ConnectSameDialog from './ConnectSameDialog.svelte';
  import { btPatternInput, btPatternOutput } from '../../../lib/stores/connectionStore';
  import { MBSpecs } from 'microbyte';
  import { DeviceRequestStates } from '../../../lib/domain/Devices';

  function connectSame() {
    Microbits.useInputAsOutput();
    $connectionDialogState.connectionState = ConnectDialogStates.NONE;
  }
</script>

<main>
  <StandardDialog
    isOpen={$connectionDialogState.connectionState !== ConnectDialogStates.NONE}
    onClose={() => ($connectionDialogState.connectionState = ConnectDialogStates.NONE)}>
    {#if $connectionDialogState.connectionState === ConnectDialogStates.START}
      <StartDialog
        onStartBluetoothClick={() =>
          ($connectionDialogState.connectionState = ConnectDialogStates.BLUETOOTH)} />
    {:else if $connectionDialogState.connectionState === ConnectDialogStates.START_OUTPUT}
      <ConnectSameDialog
        onConnectSameClick={connectSame}
        onConnectDifferentClick={() =>
          ($connectionDialogState.connectionState = ConnectDialogStates.BLUETOOTH)} />
    {:else if $connectionDialogState.connectionState === ConnectDialogStates.BLUETOOTH}
      <BluetoothConnectDialog
        onBluetoothConnected={() => {
          $connectionDialogState.connectionState = ConnectDialogStates.NONE;
        }}
        deviceState={$connectionDialogState.deviceState} />
    {/if}
  </StandardDialog>
</main>
