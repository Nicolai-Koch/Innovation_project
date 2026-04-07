/**
 * (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 *
 * SPDX-License-Identifier: MIT
 */

import { writable } from 'svelte/store';

export type ExtraRecordingRequest = {
  gestureId: number;
  targetRecordings: number;
};

export const requestedExtraRecordingRequest = writable<ExtraRecordingRequest | null>(null);

export const requestExtraRecordingForGesture = (
  gestureId: number,
  targetRecordings: number,
) => {
  requestedExtraRecordingRequest.set({
    gestureId,
    targetRecordings,
  });
};

export const clearRequestedExtraRecording = () => {
  requestedExtraRecordingRequest.set(null);
};
