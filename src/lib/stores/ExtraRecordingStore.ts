/**
 * (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 *
 * SPDX-License-Identifier: MIT
 */

import { writable } from 'svelte/store';
import type { TeamKey } from './TeamGameStore';

export type ExtraRecordingRequest = {
  gestureId: number;
  targetRecordings: number;
  team: TeamKey;
};

export const requestedExtraRecordingRequest = writable<ExtraRecordingRequest | null>(null);

export const requestExtraRecordingForGesture = (
  gestureId: number,
  targetRecordings: number,
  team: TeamKey,
) => {
  requestedExtraRecordingRequest.set({
    gestureId,
    targetRecordings,
    team,
  });
};

export const clearRequestedExtraRecording = () => {
  requestedExtraRecordingRequest.set(null);
};
