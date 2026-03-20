<script lang="ts">
  import { serviceSpecificationFromClassIdentifier } from 'jacdac-ts';
  import { bus } from './stores';
  import { useServiceProvider } from './useServiceProvider';

  export let serviceClass: number;
  export let initialState = false;

  const spec = serviceSpecificationFromClassIdentifier(serviceClass);
  let isActive = initialState;

  const toggleSimulator = () => {
    isActive = !isActive;
    // This will trigger the reactive statement in useServiceProvider
  };

  $: useServiceProvider(isActive ? { serviceClass } : {}, bus);
</script>

<button on:click={toggleSimulator} class="simulator-button" class:active={isActive}>
  {isActive ? `Stop ${spec.name}` : `Start ${spec.name}`}
</button>

<style>
  .simulator-button {
    padding: 0.5rem 1rem;
    margin-right: 0.5rem;
    font-size: 0.875rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .simulator-button:hover {
    background: #f0f0f0;
    border-color: #999;
  }

  .simulator-button.active {
    background: #2196f3;
    color: white;
    border-color: #1976d2;
  }

  .simulator-button.active:hover {
    background: #1976d2;
  }
</style>
