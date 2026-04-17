<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { adminTestMode } from '../../../lib/stores/TeamGameStore';
  import { navigate, Paths } from '../../../router/Router';
  import JacdacToolsPopup from '../../../lib/jacdac/JacdacToolsPopup.svelte';

  let isOpen = false;
  let popupElement: HTMLDivElement | null = null;

  const toggleAdminTestMode = () => {
    adminTestMode.update(value => !value);
  };

  const goToTrainAI = () => {
    if (!$adminTestMode) {
      return;
    }
    navigate(Paths.DATA);
    isOpen = false;
  };

  const goToTestRobot = () => {
    if (!$adminTestMode) {
      return;
    }
    navigate(Paths.MODEL);
    isOpen = false;
  };

  const onWindowClick = (event: MouseEvent) => {
    if (!isOpen) return;
    if (popupElement && !popupElement.contains(event.target as Node)) {
      isOpen = false;
    }
  };

</script>

<svelte:window on:click={onWindowClick} />

<div id="admin-popup" class="relative z-30" bind:this={popupElement}>
  <!-- Settings button -->
  <button
    class="rounded-lg hover:bg-white hover:bg-opacity-20 duration-100 select-none outline-none p-2 transition"
    on:click={() => (isOpen = !isOpen)}
    title="Admin indstillinger">
    <i class="fas fa-cog text-white text-xl" />
  </button>

  <!-- Popup menu -->
  {#if isOpen}
    <div
      class="absolute bottom-12 left-0 bg-white rounded-lg shadow-lg border border-gray-200 z-40 min-w-48 overflow-hidden">
      <div class="p-3 space-y-2">
        <!-- Admin toggle -->
        <button
          type="button"
          class="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 text-left"
          on:click={toggleAdminTestMode}>
          {#if $adminTestMode}
            ✓ Admin: slået til
          {:else}
            Admin: slået fra
          {/if}
        </button>

        <!-- Train AI access -->
        <button
          type="button"
          class="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100 text-left disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!$adminTestMode}
          on:click={goToTrainAI}>
          → Træn AI
        </button>

        <!-- Test Robot access -->
        <button
          type="button"
          class="w-full rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-900 transition hover:bg-green-100 text-left disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!$adminTestMode}
          on:click={goToTestRobot}>
          → Test Robot
        </button>

        <p class="text-xs text-slate-500 px-1">
          Slå admin til for at bruge siderne herunder.
        </p>

        <div class="jacdac-tool-row">
          <JacdacToolsPopup />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(#admin-popup) {
    transition: all 0.2s ease-in-out;
  }

  .jacdac-tool-row :global(.tools-button) {
    width: 100%;
  }
</style>
