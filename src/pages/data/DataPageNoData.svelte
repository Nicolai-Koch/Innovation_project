<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import NewGestureButton from '../../components/features/NewGestureButton.svelte';
  import PleaseConnect from '../../components/features/PleaseConnect.svelte';
  import { stores } from '../../lib/stores/Stores';

  const devices = stores.getDevices();
</script>

<div class="flex flex-col flex-grow justify-between">
  <div>
    {#if !$devices.isInputConnected}
      <div class="mt-4">
        <PleaseConnect />
      </div>
    {/if}
    {#if $devices.isInputConnected}
      <NewGestureButton />
    {/if}
  </div>
</div>
