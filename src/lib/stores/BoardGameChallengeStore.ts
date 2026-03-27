/**
 * (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 *
 * SPDX-License-Identifier: MIT
 */

import { derived, writable } from 'svelte/store';

const activeChallengeNumber = writable<number | null>(null);

const activeChallenge = derived(activeChallengeNumber, activeNumber => {
  if (activeNumber === null) {
    return undefined;
  }

  return {
    challengeNumber: activeNumber,
  };
});

const setActiveChallenge = (challengeNumber: number | null) => {
  activeChallengeNumber.set(challengeNumber);
};

export { activeChallenge, activeChallengeNumber, setActiveChallenge };
