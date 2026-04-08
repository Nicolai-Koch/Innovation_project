<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<style global windi:preflights:global windi:safelist:global>
  @keyframes textAni {
    0% {
      opacity: 0;
    }
    3% {
      opacity: 1;
    }
    97% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @keyframes floatBlob {
    0% {
      transform: translateY(0px) scale(1);
    }
    50% {
      transform: translateY(-8px) scale(1.03);
    }
    100% {
      transform: translateY(0px) scale(1);
    }
  }

  @keyframes connectHintFloat {
    0% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-8px);
    }
    100% {
      transform: translateY(0px);
    }
  }

  .connect-hint-card {
    animation: connectHintFloat 1.8s ease-in-out infinite;
  }

  .kid-blob {
    position: absolute;
    border-radius: 9999px;
    filter: blur(1px);
    opacity: 0.35;
    animation: floatBlob 6s ease-in-out infinite;
    pointer-events: none;
  }
</style>

<script lang="ts">
  import { fade } from 'svelte/transition';
  import { compatibility } from './lib/stores/uiStore';
  import LoadingSpinner from './components/ui/LoadingSpinner.svelte';
  import BluetoothIncompatibilityWarningDialog from './components/features/BluetoothIncompatibilityWarningDialog.svelte';
  import CookieManager from './lib/CookieManager';
  import Router from './router/Router.svelte';
  import { Feature, getFeature } from './lib/FeatureToggles';
  import { welcomeLog } from './lib/utils/Logger';
  import MediaQuery from './components/layout/MediaQuery.svelte';
  import BottomBarMenuView from './components/layout/BottomBarMenuView.svelte';
  import CookieBanner from './components/features/cookie-bannner/CookieBanner.svelte';
  import SnackbarView from './components/features/snackbar/SnackbarView.svelte';
  import IncompatiblePlatformView from './components/layout/IncompatiblePlatformView.svelte';
  import OverlayView from './components/layout/OverlayView.svelte';
  import SideBarMenuView from './components/layout/SideBarMenuView.svelte';
  import PageContentView from './components/layout/PageContentView.svelte';
  import { stores } from './lib/stores/Stores';
  import { DeviceRequestStates } from './lib/domain/Devices';
  import { isLoading } from './lib/stores/ApplicationState';
  import { connected as jacdacConnected } from './lib/jacdac/stores';

  const devices = stores.getDevices();

  welcomeLog();

  if (CookieManager.isReconnectFlagSet()) {
    $devices.offerReconnect = true;
    $devices.reconnectState = DeviceRequestStates.INPUT;
    CookieManager.unsetReconnectFlag();
  }

  document.title = getFeature(Feature.TITLE);
</script>

<Router>
  <SnackbarView />
  {#if !$compatibility.platformAllowed}
    <!-- Denies mobile users access to the platform -->
    <IncompatiblePlatformView />
  {:else}
    {#if $isLoading}
      <main class="h-screen w-screen bg-primary flex absolute z-10" transition:fade>
        <LoadingSpinner />
      </main>
    {/if}
    <!-- Here we use the hidden class, to allow for it to load in. -->
    <!-- <main class="h-screen w-screen m-0 relative flex" class:hidden={$state.isLoading}> -->
    <main class="h-screen w-screen m-0 relative flex">
      <!-- OVERLAY ITEMS -->
      <CookieBanner />
      <OverlayView />
      <BluetoothIncompatibilityWarningDialog />

      <!-- SIDE BAR -->
      <MediaQuery query="(max-width: 1500px)" let:matches={isSmall}>
        {#if isSmall}
          <div class="h-full flex min-w-65 max-w-65">
            <SideBarMenuView />
          </div>
        {:else}
          <div class="h-full flex min-w-75 max-w-75">
            <SideBarMenuView />
          </div>
        {/if}
      </MediaQuery>

      <div
        class="h-full w-full overflow-y-hidden overflow-x-auto
    flex flex-col shadow-2xl"
        style="background: linear-gradient(170deg, #fff9ed 0%, #edf8ff 48%, #f5edff 100%);">
        <div class="kid-blob w-70 h-70 -top-6 -right-8" style="background:#ffd166;" />
        <div
          class="kid-blob w-56 h-56 top-35 -left-18"
          style="background:#2ec4b6; animation-delay: 0.8s;" />
        <div
          class="kid-blob w-52 h-52 bottom-24 right-20"
          style="background:#ff6b6b; animation-delay: 1.6s;" />

        <!-- CONTENT -->
        <div class="relative z-1 flex-1 overflow-y-auto flex-row">
          <PageContentView />

          {#if !$devices.isInputConnected || !$jacdacConnected}
            <div
              class="absolute inset-0 z-20 bg-black bg-opacity-30"
              style="backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);" />

            <div class="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
              <div class="w-full max-w-5xl px-4 flex items-center justify-center gap-6">
                {#if !$devices.isInputConnected}
                  <div class="flex flex-col items-center w-60">
                    <div class="connect-hint-card rounded-xl border border-teal-200 bg-white bg-opacity-95 px-3 py-2 text-xs text-teal-900 shadow-lg">
                      <p class="font-semibold">Klik på denne knap i bunden af skærmen for at tilslutte til din microbit:</p>
                      <div class="mt-2 inline-flex items-center rounded-lg border border-teal-500 bg-white px-2.5 py-1 text-xs font-semibold text-teal-700">
                        Tilslut micro:bit
                      </div>
                    </div>
                  </div>
                {/if}

                {#if !$jacdacConnected}
                  <div class="flex flex-col items-center w-60">
                    <div class="connect-hint-card rounded-xl border border-teal-200 bg-white bg-opacity-95 px-3 py-2 text-xs text-teal-900 shadow-lg" style="animation-delay: 0.25s;">
                      <p class="font-semibold">Klik på denne knap i bunden af skærmen for at tilslutte til din Jacdac:</p>
                      <div class="mt-2 inline-flex items-center rounded-lg border border-teal-500 bg-white px-2.5 py-1 text-xs font-semibold text-teal-700">
                        Tilslut Jacdac
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- BOTTOM BAR -->
        <div class="w-full">
          <BottomBarMenuView />
        </div>
      </div>
    </main>
  {/if}
</Router>
