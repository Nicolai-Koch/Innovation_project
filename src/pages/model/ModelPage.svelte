<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { modelView, ModelView } from '../../lib/stores/ApplicationState';
  import ModelPageStackView from './stackview/ModelPageStackView.svelte';
  import ModelPageTileView from './tileview/ModelPageTileView.svelte';
</script>

<div class="pt-4 pl-3 pr-3">
  {#if $modelView == ModelView.TILE}
    <ModelPageTileView />
  {:else}
    <ModelPageStackView />
  {/if}
</div>
