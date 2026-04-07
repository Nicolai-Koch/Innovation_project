<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import TrainingFailedDialog from './TrainingFailedDialog.svelte';
  import { stores } from '../../lib/stores/Stores';
  import { Paths, navigate } from '../../router/Router';
  import StandardButton from '../../components/ui/buttons/StandardButton.svelte';
  import TrainingPageModelView from './TrainingPageModelView.svelte';
  import InsufficientData from './InsufficientData.svelte';
  import TrainingPageTabs from './controlbar/TrainingPageTabs.svelte';
  import { Feature, hasFeature } from '../../lib/FeatureToggles';

  const gestures = stores.getGestures();
  const model = stores.getClassifier().getModel();
  const sufficientData = gestures.hasSufficientData();
  const showTrainingTabs = hasFeature(Feature.KNN_MODEL);
</script>

<TrainingFailedDialog />
<div class="flex flex-col h-full">
  {#if showTrainingTabs}
    <TrainingPageTabs />
  {/if}
  <div class="px-3 py-2 flex justify-end">
    <StandardButton
      small
      onClick={() => navigate(Paths.MODEL)}
      disabled={!$model.hasModel}
      disabledTooltip="Træn modellen først, før du går til Model-siden.">
      Næste: Gå til Model
    </StandardButton>
  </div>
  {#if !sufficientData}
    <InsufficientData />
  {:else}
    <TrainingPageModelView />
  {/if}
</div>
