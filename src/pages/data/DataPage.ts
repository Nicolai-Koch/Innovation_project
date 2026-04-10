/**
 * (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 *
 * SPDX-License-Identifier: MIT
 */

import { stores } from '../../lib/stores/Stores';
import exampleDataset from '../../assets/exampleDataset.json';
import { t } from '../../i18n';
import { get, readable } from 'svelte/store';
import type { GestureData } from '../../lib/domain/stores/gesture/Gesture';
import type { PersistedGestureData } from '../../lib/domain/stores/gesture/Gestures';
import {
  activeTeam,
  adminTestMode,
  classesPerRound,
  getTeamLiveDataSource,
  jacdacGameMode,
  type TeamKey,
} from '../../lib/stores/TeamGameStore';
import StaticConfiguration from '../../StaticConfiguration';
import type { RecordingData } from '../../lib/domain/RecordingData';
import { alertUser } from '../../lib/stores/uiStore';

const customExampleDatasetStorageKey = 'custom-example-dataset-v1';
const teamDatasetStoragePrefix = 'team-gesture-dataset-v1-';

function getTeamDatasetStorageKey(team: TeamKey) {
  return `${teamDatasetStoragePrefix}${team}`;
}

function createEmptyGestures(count: number): PersistedGestureData[] {
  const gestures: PersistedGestureData[] = [];
  for (let idx = 0; idx < count; idx++) {
    gestures.push({
      ID: Date.now() + idx,
      name: (idx + 1).toString(),
      recordings: [],
      output: {},
      color: StaticConfiguration.gestureColors[idx % StaticConfiguration.gestureColors.length],
    });
  }
  return gestures;
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

export const saveTeamDatasetSnapshot = (team: TeamKey) => {
  const snapshot = serializeCurrentGestures();
  localStorage.setItem(getTeamDatasetStorageKey(team), JSON.stringify(snapshot));
};

export const loadTeamDatasetSnapshot = (team: TeamKey) => {
  const gestures = stores.getGestures();
  const availableAxes = stores.getAvailableAxes();
  const stored = localStorage.getItem(getTeamDatasetStorageKey(team));

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as PersistedGestureData[];
      if (Array.isArray(parsed)) {
        gestures.importFrom(parsed);
        availableAxes.loadFromGestures();
        return;
      }
    } catch {
      // Ignore malformed snapshots and rebuild from defaults below.
    }
  }

  const requiredCount = get(jacdacGameMode) ? 3 : StaticConfiguration.minNoOfGestures;
  gestures.importFrom(createEmptyGestures(requiredCount));
  availableAxes.loadFromGestures();
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
  activeTeam.set(nextTeam);
  loadTeamDatasetSnapshot(nextTeam);
  stores.setLiveData(getTeamLiveDataSource(nextTeam));
};

export const resetAllTeamTrainingData = () => {
  const requiredCount = get(jacdacGameMode) ? 3 : StaticConfiguration.minNoOfGestures;

  const teamAEmpty = createEmptyGestures(requiredCount);
  const teamBEmpty = createEmptyGestures(requiredCount);

  localStorage.setItem(getTeamDatasetStorageKey('A'), JSON.stringify(teamAEmpty));
  localStorage.setItem(getTeamDatasetStorageKey('B'), JSON.stringify(teamBEmpty));

  const currentTeam = get(activeTeam);
  const gestures = stores.getGestures();
  const availableAxes = stores.getAvailableAxes();

  gestures.importFrom(currentTeam === 'A' ? teamAEmpty : teamBEmpty);
  availableAxes.loadFromGestures();
  stores.setLiveData(getTeamLiveDataSource(currentTeam));
};

export const simulateRecordingForActiveTeam = () => {
  if (!get(adminTestMode)) {
    alertUser('Admin-tilstand skal være slået til for at simulere optagelser.');
    return false;
  }

  const gestures = stores.getGestures();
  const availableAxes = stores.getAvailableAxes();
  const currentTeam = get(activeTeam);

  if (gestures.getGestures().length === 0) {
    loadTeamDatasetSnapshot(currentTeam);
  }

  const teamGestures = gestures.getGestures();
  const targetGesture =
    teamGestures.find(
      gesture => gesture.getRecordings().length < StaticConfiguration.minNoOfRecordingsPerGesture,
    ) ?? teamGestures[0];

  if (!targetGesture) {
    alertUser('Der er ingen klasse at simulere en optagelse på.');
    return false;
  }

  const seed = (targetGesture.getId() % 10) + (currentTeam === 'A' ? 0 : 5);
  const samples: RecordingData['samples'] = [];

  for (let idx = 0; idx < 24; idx++) {
    const angle = (idx + seed) / 4;
    samples.push({
      vector: [
        Math.sin(angle) * 0.8 + seed * 0.05,
        Math.cos(angle * 1.2) * 0.8 + seed * 0.03,
        Math.sin(angle * 0.7 + 0.5) * 0.8,
      ],
    });
  }

  const syntheticRecording: RecordingData = {
    ID: Date.now(),
    samples,
    labels: ['X', 'Y', 'Z'],
  };

  targetGesture.addRecording(syntheticRecording);
  availableAxes.loadFromGestures();
  stores.setLiveData(getTeamLiveDataSource(currentTeam));
  return true;
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
