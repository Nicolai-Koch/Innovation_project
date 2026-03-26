<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import StandardButton from '../../ui/buttons/StandardButton.svelte';

  import { t } from '../../../i18n';
  export let onStartBluetoothClick: () => void;
</script>

<main>
  <div class="grid grid-cols-1 w-320px text-center">
    <div
      class="hover:cursor-pointer border-gray-200 border border-solid rounded-lg p-6 shadow-lg"
      on:click={onStartBluetoothClick}>
      <h1 class="font-bold">
        {$t('connectMB.main.btHeader')}
      </h1>
      <p class="mb-5">
        {$t('connectMB.main.btBody')}
      </p>
      <StandardButton icon="/imgs/bluetooth.svg">
        {$t('connectMB.main.connectButton')}
      </StandardButton>
    </div>
  </div>
</main>
