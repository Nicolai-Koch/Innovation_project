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
        <div class="ai-loader relative h-full w-full" aria-label="AI training LED ring animation">
          <span class="ai-led led-1" />
          <span class="ai-led led-2" />
          <span class="ai-led led-3" />
          <span class="ai-led led-4" />
          <span class="ai-led led-5" />
          <span class="ai-led led-6" />
          <span class="ai-led led-7" />
          <span class="ai-led led-8" />
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

  .ai-led {
    position: absolute;
    border-radius: 9999px;
    width: 0.85rem;
    height: 0.85rem;
    --led-transform: translate(0, 0);
    background: rgba(15, 23, 42, 0.18);
    box-shadow: 0 0 0 rgba(34, 211, 238, 0);
    animation: led-chase 2.24s linear infinite;
  }

  .led-1 { top: 0.2rem; left: 50%; --led-transform: translate(-50%, 0); animation-delay: 0s; }
  .led-2 { top: 1.1rem; right: 1.1rem; animation-delay: -0.28s; }
  .led-3 { top: 50%; right: 0.2rem; --led-transform: translate(0, -50%); animation-delay: -0.56s; }
  .led-4 { bottom: 1.1rem; right: 1.1rem; animation-delay: -0.84s; }
  .led-5 { bottom: 0.2rem; left: 50%; --led-transform: translate(-50%, 0); animation-delay: -1.12s; }
  .led-6 { bottom: 1.1rem; left: 1.1rem; animation-delay: -1.4s; }
  .led-7 { top: 50%; left: 0.2rem; --led-transform: translate(0, -50%); animation-delay: -1.68s; }
  .led-8 { top: 1.1rem; left: 1.1rem; animation-delay: -1.96s; }

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

  @keyframes led-chase {
    0%, 9% {
      background: rgba(15, 23, 42, 0.18);
      box-shadow: 0 0 0 rgba(34, 211, 238, 0);
      transform: var(--led-transform) scale(1);
    }
    10%, 24% {
      background: rgb(34, 211, 238);
      box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
      transform: var(--led-transform) scale(1.15);
    }
    25%, 100% {
      background: rgba(15, 23, 42, 0.18);
      box-shadow: 0 0 0 rgba(34, 211, 238, 0);
      transform: var(--led-transform) scale(1);
    }
  }
</style>