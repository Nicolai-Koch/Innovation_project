<!--
  (c) 2023-2025, Aarhus University and contributors

  SPDX-License-Identifier: MIT
-->

<script lang="ts">
  import { modelTrainingInProgress } from '../../lib/stores/ApplicationState';
</script>

{#if $modelTrainingInProgress}
  <div class="flex h-full w-full items-center justify-center bg-transparent">
    <div class="ai-loading-modal w-[22rem] max-w-[92vw] rounded-2xl bg-white p-6 shadow-2xl">
      <div class="mx-auto mb-4 h-24 w-24">
        <div class="ai-loader relative h-full w-full">
          <span class="ai-ring ai-ring-1" />
          <span class="ai-ring ai-ring-2" />
          <span class="ai-ring ai-ring-3" />
          <span class="ai-core">AI</span>
        </div>
      </div>
      <p class="text-center text-lg font-semibold">Træner model...</p>
    </div>
  </div>
{/if}

<style>
  .ai-loading-modal {
    border: 1px solid rgba(196, 208, 227, 0.9);
  }

  .ai-loader {
    display: grid;
    place-items: center;
  }

  .ai-ring {
    position: absolute;
    border-radius: 9999px;
    border: 3px solid transparent;
  }

  .ai-ring-1 {
    width: 100%;
    height: 100%;
    border-top-color: #38bdf8;
    border-right-color: #22d3ee;
    animation: spin-clockwise 1.15s linear infinite;
  }

  .ai-ring-2 {
    width: 72%;
    height: 72%;
    border-bottom-color: #6366f1;
    border-left-color: #818cf8;
    animation: spin-counter 0.95s linear infinite;
  }

  .ai-ring-3 {
    width: 44%;
    height: 44%;
    border-top-color: #06b6d4;
    border-left-color: #0ea5e9;
    animation: spin-clockwise 0.75s linear infinite;
  }

  .ai-core {
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #0f172a;
    background: linear-gradient(120deg, #38bdf8, #6366f1);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  @keyframes spin-clockwise {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-counter {
    to {
      transform: rotate(-360deg);
    }
  }
</style>