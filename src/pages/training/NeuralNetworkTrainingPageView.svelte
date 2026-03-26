<!--
  (c) 2023-2025, center for computational thinking and design at aarhus university and contributors
 
  spdx-license-identifier: mit
 -->
<script lang="ts">
  import { stores } from '../../lib/stores/Stores';
  import { loss, trainNNModel } from './TrainingPage';
  import { t } from './../../i18n';
  import Logger from '../../lib/utils/Logger';
  import { Feature, hasFeature } from '../../lib/FeatureToggles';
  import LossGraph from '../../components/features/graphs/LossGraph.svelte';
  import StandardButton from '../../components/ui/buttons/StandardButton.svelte';
  import Tooltip from '../../components/ui/Tooltip.svelte';

  const classifier = stores.getClassifier();
  const model = classifier.getModel();
  const highlightedAxes = stores.getHighlightedAxes();
  const neuralNetworkSettings = stores.getNeuralNetworkSettings();

  const trainModelClickHandler = () => {
    trainNNModel().then(() => {
      Logger.log('NeuralNetworkTrainingPageView', 'Model trained');
    });
  };

  $: trainButtonSimpleLabel = !$model.hasModel
    ? 'menu.trainer.trainModelButtonSimple'
    : 'menu.trainer.trainNewModelButtonSimple';
</script>

<div class="flex flex-row justify-center items-center flex-grow">
  <div class="flex flex-col flex-grow justify-center items-center text-center px-4">
    <div class="w-full max-w-3xl rounded-2xl p-8 bg-white bg-opacity-10 border border-white border-opacity-20">
      {#if $model.isTraining}
        <div class="ml-auto mr-auto flex center-items justify-center">
          <i
            class="fa fa-solid fa-circle-notch text-6xl animate-spin animate-duration-[2s]" />
        </div>
        {#if !hasFeature(Feature.LOSS_GRAPH)}
          <p class="text-3xl mt-4 font-bold">{$t('menu.trainer.isTrainingModelButton')}</p>
        {/if}
      {:else}
        {#if $model.isTrained && !hasFeature(Feature.LOSS_GRAPH)}
          <p class="text-3xl font-bold">{$t('menu.trainer.TrainingFinished')}</p>
          <p class="text-lg mt-4 mb-6">{$t('menu.trainer.TrainingFinished.body')}</p>
        {/if}
        <div class="relative flex justify-center">
          <Tooltip
            disabled={$highlightedAxes.length !== 0}
            title={$t('menu.trainer.SelectMoreAxes')}
            offset={{ x: 5, y: -90 }}>
            <StandardButton
              disabled={$highlightedAxes.length === 0}
              onClick={trainModelClickHandler}>
              {$t(trainButtonSimpleLabel)}
            </StandardButton>
          </Tooltip>
        </div>
      {/if}
      {#if $loss.length > 0 && hasFeature(Feature.LOSS_GRAPH) && ($model.isTrained || $model.isTraining)}
        <div class="mt-6">
          <LossGraph {loss} maxX={$neuralNetworkSettings.noOfEpochs} />
        </div>
      {/if}
    </div>
  </div>
</div>
