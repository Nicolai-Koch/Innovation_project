/**
 * (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 *
 * SPDX-License-Identifier: MIT
 */
import { get, writable } from 'svelte/store';
import KNNNonNormalizedModelTrainer from '../../lib/mlmodels/KNNNonNormalizedModelTrainer';
import { stores } from '../../lib/stores/Stores';
import { type ModelInfo } from '../../lib/domain/ModelRegistry';
import ModelRegistry from '../../lib/domain/ModelRegistry';
import LayersModelTrainer, {
  type LossTrainingIteration,
} from '../../lib/mlmodels/LayersModelTrainer';
import KNNModelTrainer from '../../lib/mlmodels/KNNModelTrainer';
import type { ModelTrainer } from '../../lib/domain/ModelTrainer';
import type { MLModel } from '../../lib/domain/MLModel';
import { loadCombinedTeamDatasetSnapshot } from '../data/DataPage';
import { modelTrainingInProgress } from '../../lib/stores/ApplicationState';
import {
  GamePhase,
  jacdacGameMode,
  notifyTrainingFinishedForGame,
  setGamePhase,
} from '../../lib/stores/TeamGameStore';

const trainSelectedModel = async () => {
  const selectedModel = get(stores.getSelectedModel()).id;
  if (selectedModel === ModelRegistry.KNN.id) {
    await trainKNNModel();
    return;
  }

  await trainNNModel();
};

export const loss = writable<LossTrainingIteration[]>([]);

const trainingIterationHandler = (h: LossTrainingIteration) => {
  loss.update(newLoss => {
    newLoss.push(h);
    return newLoss;
  });
};

export const trainNNModel = async () => {
  loss.set([]); // Reset the loss graph
  const modelTrainer = new LayersModelTrainer(
    get(stores.getNeuralNetworkSettings()),
    trainingIterationHandler,
  );
  await stores.getClassifier().getModel().train(modelTrainer);
};

export const trainKNNModel = async () => {
  const knnSettings = get(stores.getKNNModelSettings());
  const getKNNModelTrainer = (): ModelTrainer<MLModel> => {
    if (knnSettings.normalized) {
      return new KNNModelTrainer(knnSettings.k);
    } else {
      return new KNNNonNormalizedModelTrainer(knnSettings.k);
    }
  };
  await stores.getClassifier().getModel().train(getKNNModelTrainer());
};

export const trainBothTeamModels = async () => {
  modelTrainingInProgress.set(true);

  try {
    if (get(jacdacGameMode)) {
      loadCombinedTeamDatasetSnapshot();
    }

    await trainSelectedModel();

    if (get(jacdacGameMode)) {
      notifyTrainingFinishedForGame();
      setGamePhase(GamePhase.Playing);
    }
  } finally {
    modelTrainingInProgress.set(false);
  }
};

export const selectModel = async (model: ModelInfo) => {
  stores.getSelectedModel().set(model);
};
