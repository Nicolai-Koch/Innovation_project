<script lang="ts">
  import { SRV_BUTTON, SRV_LED, SRV_POTENTIOMETER, SRV_RELAY } from 'jacdac-ts';
  import SimulatorButton from './SimulatorButton.svelte';
</script>

<div class="simulator-toolbar">
  <h4>Test Simulators</h4>
  <div class="buttons-group">
    <SimulatorButton serviceClass={SRV_BUTTON} />
    <SimulatorButton serviceClass={SRV_BUTTON} />
    <SimulatorButton serviceClass={SRV_POTENTIOMETER} />
    <SimulatorButton serviceClass={SRV_LED} />
    <SimulatorButton serviceClass={SRV_RELAY} />
  </div>
</div>

<style>
  .simulator-toolbar {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f9f9f9;
  }

  h4 {
    margin-top: 0;
    margin-bottom: 0.5rem;
    color: #333;
  }

  .buttons-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
