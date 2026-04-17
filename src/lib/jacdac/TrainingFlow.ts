/**
 * (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 *
 * SPDX-License-Identifier: MIT
 */

import { get } from 'svelte/store';
import type { JDService } from 'jacdac-ts';
import { LedReg, SRV_LED } from 'jacdac-ts';
import { devices as jacdacDevices } from './stores';
import { navigate, Paths } from '../../router/Router';
import { modelTrainingInProgress } from '../stores/ApplicationState';
import { teamAColorId, teamBColorId, teamColorPalette, type TeamKey } from '../stores/TeamGameStore';
import { trainBothTeamModels } from '../../pages/training/TrainingPage';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getLedServices(): JDService[] {
  return get(jacdacDevices).flatMap(device =>
    device.services().filter((service: JDService) => service.serviceClass === SRV_LED),
  );
}

function getTeamCountdownColor(team: TeamKey) {
  const colorId = team === 'A' ? get(teamAColorId) : get(teamBColorId);
  const color = teamColorPalette.find(entry => entry.id === colorId);
  const hex = color?.hex ?? (team === 'A' ? '#2563eb' : '#dc2626');
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

async function setLedColor(service: JDService | undefined, r: number, g: number, b: number) {
  if (!service) return;

  const numPixelsRegister = service.register(LedReg.NumPixels);
  const pixelsRegister = service.register(LedReg.Pixels);
  await numPixelsRegister.refresh(true);
  const pixelCount = numPixelsRegister.uintValue || 8;
  const pixels = new Uint8Array(pixelCount * 3);

  for (let index = 0; index < pixelCount; index += 1) {
    pixels[index * 3] = r;
    pixels[index * 3 + 1] = g;
    pixels[index * 3 + 2] = b;
  }

  await pixelsRegister.sendSetPackedAsync([pixels], true);
}

async function setSpinnerLed(
  service: JDService | undefined,
  activeLedIndex: number,
  color: { r: number; g: number; b: number },
) {
  if (!service) return;

  const numPixelsRegister = service.register(LedReg.NumPixels);
  const pixelsRegister = service.register(LedReg.Pixels);
  await numPixelsRegister.refresh(true);
  const pixelCount = numPixelsRegister.uintValue || 8;
  const activeLeds = Math.min(pixelCount, 8);
  const safeLedIndex = ((activeLedIndex % activeLeds) + activeLeds) % activeLeds;
  const pixels = new Uint8Array(pixelCount * 3);

  for (let index = 0; index < pixelCount; index += 1) {
    const isActive = index === safeLedIndex;
    pixels[index * 3] = isActive ? color.r : 0;
    pixels[index * 3 + 1] = isActive ? color.g : 0;
    pixels[index * 3 + 2] = isActive ? color.b : 0;
  }

  await pixelsRegister.sendSetPackedAsync([pixels], true);
}

function getLedServiceForTeam(team: TeamKey): JDService | undefined {
  const ledServices = getLedServices();
  if (ledServices.length === 0) return undefined;
  return team === 'A' ? ledServices[0] : ledServices[1] || ledServices[0];
}

export async function trainBothTeamsWithLedAnimation() {
  if (get(modelTrainingInProgress)) {
    return;
  }

  modelTrainingInProgress.set(true);
  navigate(Paths.TRAINING);

  const ledA = getLedServiceForTeam('A');
  const ledB = getLedServiceForTeam('B');
  const colorA = getTeamCountdownColor('A');
  const colorB = getTeamCountdownColor('B');

  try {
    const trainingPromise = trainBothTeamModels();
    let trainingDone = false;

    void trainingPromise.finally(() => {
      trainingDone = true;
    });

    let activeLedIndex = 0;

    while (!trainingDone) {
      await Promise.all([
        Promise.race([
          setSpinnerLed(ledA, activeLedIndex, colorA),
          delay(180),
        ]).catch(() => undefined),
        Promise.race([
          setSpinnerLed(ledB, activeLedIndex, colorB),
          delay(180),
        ]).catch(() => undefined),
      ]);
      activeLedIndex = (activeLedIndex + 1) % 8;
      await delay(220);
    }

    await trainingPromise;

    await Promise.all([
      setLedColor(ledA, colorA.r, colorA.g, colorA.b),
      setLedColor(ledB, colorB.r, colorB.g, colorB.b),
    ]);

    navigate(Paths.MODEL);
  } catch (error) {
    console.error('Training flow failed:', error);
    await Promise.all([setLedColor(ledA, 255, 0, 0), setLedColor(ledB, 255, 0, 0)]);
    await delay(1000);
    await Promise.all([setLedColor(ledA, 0, 0, 0), setLedColor(ledB, 0, 0, 0)]);
  } finally {
    modelTrainingInProgress.set(false);
  }
}