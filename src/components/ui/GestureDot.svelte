<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->
<script lang="ts">
  import type Gesture from '../../lib/domain/stores/gesture/Gesture';

  let isDotHovered = false;
  export let gesture: Gesture;
  export let disableTooltip: boolean = false;
  export let editable: boolean = false;

  $: name = $gesture.name;
  $: color = $gesture.color;

  function onColorInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target?.value) {
      return;
    }
    gesture.setColor(target.value);
  }
</script>

<div
  class="absolute border-1 border-secondary rounded-md shadow-md bg-white top-[-28px]"
  class:hidden={!isDotHovered || disableTooltip}>
  <p class="px-2">{name}</p>
</div>
<div
  on:mouseenter={() => (isDotHovered = true)}
  on:mouseleave={() => (isDotHovered = false)}
  role="presentation"
  class="relative w-3 h-3 z-2 rounded-full"
  style="background-color: {color};">
  {#if editable}
    <input
      type="color"
      aria-label="Vælg klassefarve"
      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      value={color}
      on:input={onColorInput} />
  {/if}
</div>
