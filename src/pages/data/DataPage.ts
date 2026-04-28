/**
 * (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 *
 * SPDX-License-Identifier: MIT
 */

import { get, readable } from 'svelte/store';
import exampleDataset from '../../assets/exampleDataset.json';
import { t } from '../../i18n';
import type { RecordingData } from '../../lib/domain/RecordingData';
import type { GestureData } from '../../lib/domain/stores/gesture/Gesture';
import type { PersistedGestureData } from '../../lib/domain/stores/gesture/Gestures';
import { stores } from '../../lib/stores/Stores';
import {
  activeTeam,
  getTeamLiveDataSource,
  jacdacGameMode,
  markTeamTrainingComplete,
  setActiveTeam,
  type TeamKey,
} from '../../lib/stores/TeamGameStore';
import { alertUser } from '../../lib/stores/uiStore';
import StaticConfiguration from '../../StaticConfiguration';

const customExampleDatasetStorageKey = 'custom-example-dataset-v1';
const teamDatasetStoragePrefix = 'team-gesture-dataset-v1-';
const hiddenStillRecordingsStorageKey = 'hidden-still-recordings-v1';
const hiddenStillLockedStorageKey = 'hidden-still-recordings-locked-v1';

const TEAM_CLASS_IDS: Record<TeamKey, number[]> = {
  A: [1, 2, 3],
  B: [4, 5, 6],
};

function getTeamDatasetStorageKey(team: TeamKey) {
  return `${teamDatasetStoragePrefix}${team}`;
}

function createGestureForClass(classId: number): PersistedGestureData {
  return {
    ID: classId,
    name: classId.toString(),
    recordings: [],
    output: {},
    color: StaticConfiguration.gestureColors[(classId - 1) % StaticConfiguration.gestureColors.length],
  };
}

function createEmptyGesturesForTeam(team: TeamKey): PersistedGestureData[] {
  return TEAM_CLASS_IDS[team].map(classId => createGestureForClass(classId));
}

function resolveClassIdFromGesture(gesture: PersistedGestureData): number | null {
  if (Number.isInteger(gesture.ID) && gesture.ID > 0) {
    return gesture.ID;
  }

  const parsedName = Number.parseInt(gesture.name, 10);
  if (Number.isInteger(parsedName) && parsedName > 0) {
    return parsedName;
  }

  return null;
}

function normalizeTeamDatasetSnapshot(
  team: TeamKey,
  snapshot: PersistedGestureData[] | null,
): PersistedGestureData[] {
  const fallback = createEmptyGesturesForTeam(team);
  if (!snapshot) {
    return fallback;
  }

  const byClassId = new Map<number, PersistedGestureData>();
  snapshot.forEach(gesture => {
    const classId = resolveClassIdFromGesture(gesture);
    if (classId == null || !TEAM_CLASS_IDS[team].includes(classId)) {
      return;
    }

    byClassId.set(classId, {
      ID: classId,
      name: gesture.name || classId.toString(),
      recordings: Array.isArray(gesture.recordings) ? gesture.recordings : [],
      output: gesture.output ?? {},
      color:
        gesture.color ??
        StaticConfiguration.gestureColors[(classId - 1) % StaticConfiguration.gestureColors.length],
    });
  });

  return TEAM_CLASS_IDS[team].map(classId => byClassId.get(classId) ?? createGestureForClass(classId));
}

function serializeCurrentGestures(): PersistedGestureData[] {
  return stores
    .getGestures()
    .getGestures()
    .map(gesture => ({
      ID: gesture.getId(),
      name: gesture.getName(),
      recordings: gesture.getRecordings(),
      output: gesture.getOutput(),
      color: gesture.getColor(),
    }));
}

function hasEnoughDataForTraining(
  gestures: Array<{ recordings: RecordingData[] }>,
  requiredCount: number,
): boolean {
  return (
    gestures.length >= requiredCount &&
    gestures.every(
      gesture => gesture.recordings.length >= StaticConfiguration.minNoOfRecordingsPerGesture,
    )
  );
}

export function getStoredTeamDatasetSnapshot(team: TeamKey): PersistedGestureData[] | null {
  const stored = localStorage.getItem(getTeamDatasetStorageKey(team));
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as PersistedGestureData[];
    return Array.isArray(parsed) ? normalizeTeamDatasetSnapshot(team, parsed) : null;
  } catch {
    return null;
  }
}

export const importExampleDataset = () => {
  const gestures = stores.getGestures();
  const availableAxes = stores.getAvailableAxes();

  // Imports 3 gestures, named Shake, Still and Circle (in that order)
  gestures.importFrom(exampleDataset);
  // Translate the names, that are originally english
  gestures.getGestures()[0].setName(get(t)('content.data.noData.exampleName.shake'));
  gestures.getGestures()[1].setName(get(t)('content.data.noData.exampleName.still'));
  gestures.getGestures()[2].setName(get(t)('content.data.noData.exampleName.circle'));
  availableAxes.loadFromGestures();
};

export const hasStoredExampleDataset = () => {
  return !!localStorage.getItem(customExampleDatasetStorageKey);
};

export const saveCurrentAsExampleDataset = () => {
  const snapshot = serializeCurrentGestures();

  localStorage.setItem(customExampleDatasetStorageKey, JSON.stringify(snapshot));
};

export const importStoredOrDefaultExampleDataset = () => {
  const gestures = stores.getGestures();
  const availableAxes = stores.getAvailableAxes();

  const stored = localStorage.getItem(customExampleDatasetStorageKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as PersistedGestureData[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        gestures.importFrom(parsed);
        availableAxes.loadFromGestures();
        return;
      }
    } catch {
      // Fall back to default dataset on malformed custom snapshot.
    }
  }

  importExampleDataset();
};

export const saveTeamDatasetSnapshot = (team: TeamKey) => {
  const snapshot = normalizeTeamDatasetSnapshot(team, serializeCurrentGestures());

  localStorage.setItem(getTeamDatasetStorageKey(team), JSON.stringify(snapshot));
  markTeamTrainingComplete(team, hasEnoughDataForTraining(snapshot, TEAM_CLASS_IDS[team].length));
};

export const loadTeamDatasetSnapshot = (team: TeamKey) => {
  const gestures = stores.getGestures();
  const availableAxes = stores.getAvailableAxes();
  const normalizedSnapshot = normalizeTeamDatasetSnapshot(team, getStoredTeamDatasetSnapshot(team));

  localStorage.setItem(getTeamDatasetStorageKey(team), JSON.stringify(normalizedSnapshot));
  gestures.importFrom(normalizedSnapshot);
  availableAxes.loadFromGestures();
  markTeamTrainingComplete(
    team,
    hasEnoughDataForTraining(normalizedSnapshot, TEAM_CLASS_IDS[team].length),
  );
};

export const getCombinedTeamDatasetSnapshot = (): PersistedGestureData[] => {
  const teamASnapshot = normalizeTeamDatasetSnapshot('A', getStoredTeamDatasetSnapshot('A'));
  const teamBSnapshot = normalizeTeamDatasetSnapshot('B', getStoredTeamDatasetSnapshot('B'));

  return [...teamASnapshot, ...teamBSnapshot].sort((left, right) => left.ID - right.ID);
};

export const loadCombinedTeamDatasetSnapshot = () => {
  const gestures = stores.getGestures();
  const availableAxes = stores.getAvailableAxes();
  const combinedSnapshot = getCombinedTeamDatasetSnapshot();

  gestures.importFrom(combinedSnapshot);
  availableAxes.loadFromGestures();
  return combinedSnapshot;
};

export const switchActiveTrainingTeam = (nextTeam: TeamKey) => {
  if (!get(jacdacGameMode)) {
    return;
  }

  const previousTeam = get(activeTeam);
  if (previousTeam === nextTeam) {
    return;
  }

  saveTeamDatasetSnapshot(previousTeam);
  setActiveTeam(nextTeam);
  loadTeamDatasetSnapshot(nextTeam);
  stores.setLiveData(getTeamLiveDataSource(nextTeam));
};

export const resetAllTeamTrainingData = () => {
  const teamAEmpty = createEmptyGesturesForTeam('A');
  const teamBEmpty = createEmptyGesturesForTeam('B');

  localStorage.setItem(getTeamDatasetStorageKey('A'), JSON.stringify(teamAEmpty));
  localStorage.setItem(getTeamDatasetStorageKey('B'), JSON.stringify(teamBEmpty));
  markTeamTrainingComplete('A', false);
  markTeamTrainingComplete('B', false);

  const currentTeam = get(activeTeam);
  const gestures = stores.getGestures();
  const availableAxes = stores.getAvailableAxes();

  gestures.importFrom(currentTeam === 'A' ? teamAEmpty : teamBEmpty);
  availableAxes.loadFromGestures();
  stores.setLiveData(getTeamLiveDataSource(currentTeam));
};

export function getHiddenStillRecordings(): RecordingData[] {
  const stored = localStorage.getItem(hiddenStillRecordingsStorageKey);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as RecordingData[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isHiddenStillRecordingsLocked(): boolean {
  return localStorage.getItem(hiddenStillLockedStorageKey) === 'true';
}

function saveHiddenStillRecordings(recordings: RecordingData[]) {
  localStorage.setItem(hiddenStillRecordingsStorageKey, JSON.stringify(recordings));
}

export function addHiddenStillRecording(recording: RecordingData): RecordingData[] {
  const recordings = getHiddenStillRecordings();
  const nextRecordings = [...recordings, recording];
  saveHiddenStillRecordings(nextRecordings);
  return nextRecordings;
}

export function removeHiddenStillRecording(recordingId: number): RecordingData[] {
  const nextRecordings = getHiddenStillRecordings().filter(recording => recording.ID !== recordingId);
  saveHiddenStillRecordings(nextRecordings);
  return nextRecordings;
}

export function lockHiddenStillRecordings() {
  localStorage.setItem(hiddenStillLockedStorageKey, 'true');
}

export function unlockHiddenStillRecordings() {
  localStorage.setItem(hiddenStillLockedStorageKey, 'false');
}

export const hasSomeRecordingData = readable(false, set => {
  const unsubscribe = stores.getGestures().subscribe(gestures => {
    if (gestures.length === 0) {
      set(false);
      return;
    }
    set(gestures.some((gesture: GestureData) => gesture.recordings.length > 0));
  });

  return unsubscribe;
});
