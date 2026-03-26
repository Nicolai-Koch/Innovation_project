<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<style>
  .hero-card {
    background: rgba(255, 255, 255, 0.82);
    border: 2px solid rgba(255, 255, 255, 0.95);
    border-radius: 22px;
    box-shadow: 0 14px 30px rgba(36, 41, 58, 0.1);
  }
</style>

<script lang="ts">
  import ControlBar from '../components/ui/control-bar/ControlBar.svelte';
  import ContactUsControlBarButton from '../components/ui/control-bar/control-bar-items/ContactUsControlBarButton.svelte';
  import SelectLanguageControlBarDropdown from '../components/ui/control-bar/control-bar-items/SelectLanguageControlBarDropdown.svelte';
  import { t } from '../i18n';
  import Environment from '../lib/Environment';
  import DevTools from '../components/features/GoToPlaygroundButton.svelte';
  import { isLoading } from '../lib/stores/ApplicationState';
</script>

<main class="h-full flex flex-col">
  <div class:hidden={$isLoading}>
    <div>
      <ControlBar>
        <div class="w-full">
          {#if Environment.isInDevelopment}
            <div class="float-left flex flex-row">
              <p>(DevTools)</p>
              <DevTools />
            </div>
          {/if}
          <div class="float-right flex flex-row">
            <ContactUsControlBarButton />
            <SelectLanguageControlBarDropdown />
          </div>
        </div>
      </ControlBar>
    </div>
    <div class="p-8 pt-4">
      <div class="hero-card max-w-4xl mx-auto p-8">
        <h1 class="text-4xl font-bold mb-6 text-center">{$t('content.index.heading')}</h1>

        <div class="flex flex-col gap-3 text-xl">
          <div class="bg-white bg-opacity-75 rounded-xl p-4 font-semibold text-center">
            1. Optag data -> 2. Træn model -> 3. Se resultat
          </div>
        </div>
      </div>
    </div>
    <div class="flex-grow flex items-end">
      <div class="pb-2 pl-10">
        <p>
          {$t('content.index.acknowledgement')} -
          <a class="text-link hover:underline" href="https://cctd.au.dk/">cctd.au.dk</a>
        </p>
      </div>
    </div>
  </div>
</main>
