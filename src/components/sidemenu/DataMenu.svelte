<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { stores } from '../../lib/stores/Stores';

  const gestures = stores.getGestures();

  $: numberOfClasses = $gestures.length;
</script>

<div class="w-full text-center justify-center pt-5 pb-7">
  <div class="text-3xl mb-3 text-secondarytext">
    <i class="fas fa-robot" aria-hidden="true" />
  </div>
  <p class="text-7xl mb-4">{numberOfClasses}</p>
  <p class="text-xl">Antal bevægelser</p>
</div>
