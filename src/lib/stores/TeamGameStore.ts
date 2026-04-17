/**
 * (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 *
 * SPDX-License-Identifier: MIT
 */

import { get } from 'svelte/store';
import PersistantWritable from '../repository/PersistantWritable';
import { writable } from 'svelte/store';
import LiveDataBuffer from '../domain/LiveDataBuffer';
import MicrobitAccelerometerLiveData, {
  MicrobitAccelerometerDataVector,
} from '../livedata/MicrobitAccelerometerData';
import StaticConfiguration from '../../StaticConfiguration';

export type TeamColor = {
  id: string;
  label: string;
  hex: string;
};

export type TeamKey = 'A' | 'B';

export enum GamePhase {
  Setup = 'setup',
  Training = 'training',
  Playing = 'playing',
  Paused = 'paused',
  Finished = 'finished',
}

export const teamColorPalette: TeamColor[] = [
  { id: 'blue', label: 'Blaa', hex: '#2563eb' },
  { id: 'red', label: 'Roed', hex: '#dc2626' },
  { id: 'green', label: 'Groen', hex: '#16a34a' },
  { id: 'yellow', label: 'Gul', hex: '#ca8a04' },
  { id: 'purple', label: 'Lilla', hex: '#7c3aed' },
  { id: 'orange', label: 'Orange', hex: '#ea580c' },
];

export const teamAColorId = new PersistantWritable<string | null>(null, 'teamAColorId');
export const teamBColorId = new PersistantWritable<string | null>(null, 'teamBColorId');

export const teamAConfirmed = new PersistantWritable<boolean>(false, 'teamAConfirmed');
export const teamBConfirmed = new PersistantWritable<boolean>(false, 'teamBConfirmed');

export const teamASetupIndex = new PersistantWritable<number>(0, 'teamASetupIndex');
export const teamBSetupIndex = new PersistantWritable<number>(0, 'teamBSetupIndex');

export const jacdacGameMode = new PersistantWritable<boolean>(true, 'jacdacGameMode');
export const classesPerRound = new PersistantWritable<number>(3, 'classesPerRound');
export const currentRound = new PersistantWritable<number>(1, 'currentRound');
export const gamePhase = new PersistantWritable<GamePhase>(GamePhase.Setup, 'gamePhase');
export const activeTeam = new PersistantWritable<TeamKey>('A', 'activeTeam');
export const teamATrainingComplete = new PersistantWritable<boolean>(false, 'teamATrainingComplete');
export const teamBTrainingComplete = new PersistantWritable<boolean>(false, 'teamBTrainingComplete');
export const teamAScore = new PersistantWritable<number>(0, 'teamAScore');
export const teamBScore = new PersistantWritable<number>(0, 'teamBScore');
export const maxClassesPerRound = 6;
export const modelTrainingTeam = writable<TeamKey | null>(null);
export const adminTestMode = new PersistantWritable<boolean>(false, 'adminTestMode');
export const teamARaceProgress = writable(0);
export const teamBRaceProgress = writable(0);
export const raceWinner = writable<TeamKey | null>(null);
export const teamAPredictionConfidences = writable<Record<number, number>>({});
export const teamBPredictionConfidences = writable<Record<number, number>>({});

export const teamRaceSequence: Record<TeamKey, number[]> = {
  A: [0, 1, 2, 5, 4, 3],
  B: [3, 4, 5, 2, 1, 0],
};

const teamALiveData = new MicrobitAccelerometerLiveData(
  new LiveDataBuffer<MicrobitAccelerometerDataVector>(StaticConfiguration.accelerometerLiveDataBufferSize),
);
const teamBLiveData = new MicrobitAccelerometerLiveData(
  new LiveDataBuffer<MicrobitAccelerometerDataVector>(StaticConfiguration.accelerometerLiveDataBufferSize),
);

export const teamALiveXYZ = writable({ x: 0, y: 0, z: 0 });
export const teamBLiveXYZ = writable({ x: 0, y: 0, z: 0 });

export function pushTeamLiveSample(team: TeamKey, x: number, y: number, z: number) {
  const sample = new MicrobitAccelerometerDataVector({ x, y, z });
  if (team === 'A') {
    teamALiveData.put(sample);
    teamALiveXYZ.set({ x, y, z });
    return;
  }

  teamBLiveData.put(sample);
  teamBLiveXYZ.set({ x, y, z });
}

export function getTeamLiveDataSource(team: TeamKey) {
  return team === 'A' ? teamALiveData : teamBLiveData;
}

export function setRoundClassCount(nextCount: number) {
  classesPerRound.set(Math.max(3, Math.min(nextCount, maxClassesPerRound)));
}

export function getTeamColorIdAtIndex(index: number) {
  const paletteIndex = ((index % teamColorPalette.length) + teamColorPalette.length) % teamColorPalette.length;
  return teamColorPalette[paletteIndex]?.id ?? null;
}

export function getTeamColorIndexById(colorId: string | null) {
  if (!colorId) {
    return 0;
  }
  const paletteIndex = teamColorPalette.findIndex(color => color.id === colorId);
  return paletteIndex >= 0 ? paletteIndex : 0;
}

export function setTeamColorByIndex(team: 'A' | 'B', index: number) {
  const colorId = getTeamColorIdAtIndex(index);
  if (!colorId) {
    return;
  }

  if (team === 'A') {
    if (get(teamBConfirmed) && get(teamBColorId) === colorId) {
      return;
    }
    teamASetupIndex.set(index);
    teamAColorId.set(colorId);
    teamAConfirmed.set(false);
    return;
  }

  if (get(teamAConfirmed) && get(teamAColorId) === colorId) {
    return;
  }
  teamBSetupIndex.set(index);
  teamBColorId.set(colorId);
  teamBConfirmed.set(false);
}

export function isColorLockedForTeam(team: 'A' | 'B', colorId: string | null) {
  if (!colorId) {
    return false;
  }

  if (team === 'A') {
    return get(teamBConfirmed) && get(teamBColorId) === colorId;
  }

  return get(teamAConfirmed) && get(teamAColorId) === colorId;
}

export function confirmTeamColor(team: 'A' | 'B') {
  const colorId = team === 'A' ? get(teamAColorId) : get(teamBColorId);
  if (isColorLockedForTeam(team, colorId)) {
    return false;
  }

  if (team === 'A') {
    teamAConfirmed.set(true);
    return true;
  }
  teamBConfirmed.set(true);
  return true;
}

export function setTeamColorConfirmation(team: 'A' | 'B', confirmed: boolean) {
  if (team === 'A') {
    teamAConfirmed.set(confirmed);
    return;
  }

  teamBConfirmed.set(confirmed);
}

export function isTeamSetupConfirmed(team: 'A' | 'B') {
  return team === 'A' ? get(teamAConfirmed) : get(teamBConfirmed);
}

export function advanceRound() {
  const nextCount = Math.min(get(classesPerRound) + 1, maxClassesPerRound);
  classesPerRound.set(nextCount);
  currentRound.set(get(currentRound) + 1);
}

export function resetGameSession() {
  teamAColorId.set(null);
  teamBColorId.set(null);
  teamAConfirmed.set(false);
  teamBConfirmed.set(false);
  teamASetupIndex.set(0);
  teamBSetupIndex.set(0);
  activeTeam.set('A');
  teamATrainingComplete.set(false);
  teamBTrainingComplete.set(false);
  resetRaceState();
  classesPerRound.set(3);
  currentRound.set(1);
  gamePhase.set(GamePhase.Setup);
  teamAScore.set(0);
  teamBScore.set(0);
}

export function startCompetitiveRound() {
  activeTeam.set('A');
  teamATrainingComplete.set(false);
  teamBTrainingComplete.set(false);
  resetRaceState();
  gamePhase.set(GamePhase.Training);
}

export function setActiveTeam(team: TeamKey) {
  activeTeam.set(team);
}

export function markTeamTrainingComplete(team: TeamKey, isComplete = true) {
  if (team === 'A') {
    teamATrainingComplete.set(isComplete);
    return;
  }
  teamBTrainingComplete.set(isComplete);
}

export function resetRaceState() {
  teamARaceProgress.set(0);
  teamBRaceProgress.set(0);
  raceWinner.set(null);
  teamAPredictionConfidences.set({});
  teamBPredictionConfidences.set({});
}

export function setTeamPredictionConfidences(
  team: TeamKey,
  confidences: Record<number, number>,
) {
  if (team === 'A') {
    teamAPredictionConfidences.set(confidences);
    return;
  }

  teamBPredictionConfidences.set(confidences);
}

export function getTeamRaceProgress(team: TeamKey) {
  return team === 'A' ? get(teamARaceProgress) : get(teamBRaceProgress);
}

export function getTeamRaceSequence(team: TeamKey) {
  return teamRaceSequence[team];
}

export function getRaceWinner() {
  return get(raceWinner);
}

export function setRaceWinner(team: TeamKey) {
  if (get(raceWinner) !== null) {
    return;
  }
  raceWinner.set(team);
  gamePhase.set(GamePhase.Finished);
}

export function advanceTeamRaceProgress(team: TeamKey) {
  if (get(raceWinner) !== null) {
    return;
  }

  const maxProgress = getTeamRaceSequence(team).length;

  if (team === 'A') {
    teamARaceProgress.update(value => Math.min(value + 1, maxProgress));
    return;
  }

  teamBRaceProgress.update(value => Math.min(value + 1, maxProgress));
}

export function setRaceProgress(team: TeamKey, nextProgress: number) {
  if (team === 'A') {
    teamARaceProgress.set(nextProgress);
    return;
  }

  teamBRaceProgress.set(nextProgress);
}

export function startRace() {
  gamePhase.set(GamePhase.Playing);
}

export function pauseRace() {
  if (get(gamePhase) === GamePhase.Playing) {
    gamePhase.set(GamePhase.Paused);
  }
}

export function areBothTeamsTrainingComplete() {
  return get(teamATrainingComplete) && get(teamBTrainingComplete);
}

export function advanceCompetitiveRound() {
  advanceRound();
  startCompetitiveRound();
}

export function resolveCompetitiveRound(winner: TeamKey | null) {
  if (winner) {
    addTeamScore(winner, 1);
  }

  advanceCompetitiveRound();
}

export function setGamePhase(phase: GamePhase) {
  gamePhase.set(phase);
}

export function addTeamScore(team: 'A' | 'B', delta: number) {
  if (team === 'A') {
    teamAScore.set(get(teamAScore) + delta);
    return;
  }
  teamBScore.set(get(teamBScore) + delta);
}
