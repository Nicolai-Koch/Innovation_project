<!--
  (c) 2023-2025, Aarhus University and contributors

  SPDX-License-Identifier: MIT
-->

<script lang="ts">
  import type Gesture from '../../../lib/domain/stores/gesture/Gesture';
  import { activeChallengeNumber, setActiveChallenge } from '../../../lib/stores/BoardGameChallengeStore';
  import { stores } from '../../../lib/stores/Stores';

  export let gesture: Gesture;

  $: challengeNumber = stores.getGestures().getGestures().findIndex(item => item.getId() === gesture.getId()) + 1;

  const fallbackRowBackgroundColor = 'rgba(240, 240, 240, 0.85)';

  function hexToRgba(hexColor: string, alpha: number): string | undefined {
    const hex = hexColor.trim().replace('#', '');
    const isValid = /^[0-9a-fA-F]{6}$/.test(hex);
    if (!isValid) {
      return undefined;
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getPastelBackground(hexColor: string): string {
    return hexToRgba(hexColor, 0.2) ?? fallbackRowBackgroundColor;
  }

  const toggleChallenge = () => {
    if ($activeChallengeNumber === challengeNumber) {
      setActiveChallenge(null);
      return;
    }

    setActiveChallenge(challengeNumber);
  };

</script>

<div
  class="rounded-xl h-36 w-28 p-2 flex items-center justify-center"
  style="background-color: {getPastelBackground($gesture.color)};">
  <div class="border-1 border-solid rounded-xl border-primaryborder bg-white h-full w-full flex items-center justify-center">
    <label class="flex items-center justify-center text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        class="h-5 w-5"
        style="accent-color: {$gesture.color};"
        checked={$activeChallengeNumber === challengeNumber}
        on:change={toggleChallenge} />
    </label>
  </div>
</div>