<script lang="ts">
  import { onMount } from 'svelte';
  import { connected, error, initializeBus, connectToBus, disconnectFromBus } from './stores';

  export let compact = false;

  let isConnecting = false;
  let errorMessage: string | null = null;
  let initialized = false;

  onMount(() => {
    // Initialize bus listeners once on component mount
    if (!initialized) {
      initializeBus();
      initialized = true;
      console.log('Jacdac bus initialized');
    }

    // Subscribe to error store
    const unsubscribe = error.subscribe((err) => {
      errorMessage = err;
    });

    return unsubscribe;
  });

  const handleClick = async () => {
    if (isConnecting) return;

    isConnecting = true;
    try {
      if ($connected) {
        await disconnectFromBus();
      } else {
        // Don't await other operations before connecting
        await connectToBus();
      }
    } catch (err) {
      console.error('Connection error:', err);
    } finally {
      isConnecting = false;
    }
  };
</script>

<div class="connect-button-container">
  <button
    on:click={handleClick}
    disabled={isConnecting}
    class="connect-button"
    class:connected={$connected}
  >
    {isConnecting ? 'Connecting...' : $connected ? 'Jacdac connected' : 'Connect Jacdac'}
  </button>

  {#if errorMessage && !compact}
    <div class="error-message">
      <strong>Error:</strong> {errorMessage}
    </div>
  {/if}

  {#if !compact}
    {#if $connected}
      <div class="status-message success">
        Connected to Jacdac Bus
      </div>
    {:else}
      <div class="status-message">
        Not connected
      </div>
    {/if}
  {/if}
</div>

<style>
  .connect-button-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
  }

  .connect-button {
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
    border: 2px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .connect-button:hover:not(:disabled) {
    background: #f0f0f0;
    border-color: #999;
  }

  .connect-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .connect-button.connected {
    background: #4caf50;
    color: white;
    border-color: #2e7d32;
  }

  .connect-button.connected:hover {
    background: #45a049;
  }

  .status-message {
    font-size: 0.875rem;
    padding: 0.5rem;
    border-radius: 4px;
    background: #e3f2fd;
    color: #1976d2;
  }

  .status-message.success {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .error-message {
    font-size: 0.875rem;
    padding: 0.5rem;
    border-radius: 4px;
    background: #ffebee;
    color: #c62828;
  }
</style>
