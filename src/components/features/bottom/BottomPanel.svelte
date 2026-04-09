<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { fade } from 'svelte/transition';
  import LiveGraphInformationSection from './LiveGraphInformationSection.svelte';
  import { tr } from '../../../i18n';
  import ConnectDialogContainer from '../../features/connection-prompt/ConnectDialogContainer.svelte';
  import { startConnectionProcess } from '../../../lib/stores/connectDialogStore';
  import View3DLive from '../3d-inspector/View3DLive.svelte';
  import BaseDialog from '../../ui/dialogs/BaseDialog.svelte';
  import MicrobitLiveGraph from '../graphs/MicrobitLiveGraph.svelte';
  import { stores } from '../../../lib/stores/Stores';
  import JacdacConnectButton from '../../../lib/jacdac/ConnectButton.svelte';
  import { currentPath, Paths } from '../../../router/Router';

  const devices = stores.getDevices();

  let componentWidth: number;
  let connectDialogReference: ConnectDialogContainer;

  const connectButtonClicked = () => {
    startConnectionProcess();
  };

  let isLive3DOpen = false;
</script>

<div
  bind:clientWidth={componentWidth}
  class="w-full bg-white border-t border-solid border-black border-opacity-60 shadow-black shadow-xl"
  style:height={$devices.isInputAssigned ? '160px' : '88px'}
  class:bg-gray-300={$devices.isInputAssigned && !$devices.isInputReady}>
  <ConnectDialogContainer bind:this={connectDialogReference} />

  {#if !$devices.isInputAssigned}
    <!-- No input microbit assigned -->
    <div class="h-full w-full flex justify-center items-center bg-white">
      <div class="flex flex-row items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center rounded-lg border border-teal-500 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm hover:bg-teal-50 transition-colors"
          on:click={connectButtonClicked}>
          Tilslut micro:bit
        </button>
        <JacdacConnectButton compact={true} />
      </div>
    </div>
  {:else}
    <!-- Input microbit is assigned -->
    <div class="relative w-full h-full">
      <div class="absolute w-full h-full">
        <MicrobitLiveGraph width={componentWidth - 180} />
      </div>
      {#if $devices.isInputInitializing}
        <div
          class="absolute w-full h-full flex items-center justify-center text-secondarytext">
          <div class="bg-secondary bg-opacity-80 py-2 px-4 rounded-full" transition:fade>
            <h1>{$tr('footer.reconnecting')}</h1>
          </div>
        </div>
      {/if}
      <div
        class="h-full p-0 m-0 absolute top-0 left-0 right-45 border-r border-solid border-black border-opacity-60">
        <!-- The live text and info box -->
        <div class="float-left mt-2 ml-2">
          <LiveGraphInformationSection />
        </div>
        <div class="absolute right-4 bottom-2 m-0 float-right z-10">
          <div class="flex flex-row items-center gap-2">
            <JacdacConnectButton compact={true} />
          </div>
        </div>
      </div>

      <!-- Right part of live-graph -->
      <div class="absolute right-0 bottom-0 h-full w-45 flex flex-col justify-between">
        <div
          class="flex flex-row pl-4 justify-center cursor-pointer hover:bg-secondary hover:bg-opacity-10 transition"
          on:click={() => (isLive3DOpen = true)}>
          <View3DLive width={140} height={140} freeze={isLive3DOpen} />
        </div>
      </div>

      <BaseDialog isOpen={isLive3DOpen} onClose={() => (isLive3DOpen = false)}>
        <!-- hardcoded margin-left matches the size of the sidebar -->
        <div
          class="ml-75 border-gray-200 overflow-hidden border border-solid relative bg-white rounded-1 shadow-dark-400 shadow-md flex justify-center"
          style="height: calc(100vh - 160px); width: calc(100vh - 160px);">
          <div class="-mt-5 w-full h-full justify-center align-middle flex items-center">
            <View3DLive width={600} height={600} smoothing />
          </div>
        </div>
      </BaseDialog>
    </div>
  {/if}
</div>
