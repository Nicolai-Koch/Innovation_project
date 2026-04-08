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
  {#key $connected}
    <button
      type="button"
      class="inline-flex items-center font-semibold transition-colors"
      class:connected={$connected}
      class:disconnected={!$connected}
      class:compact={compact}
      class:regular={!compact}
      on:click={handleClick}
    >
      {$connected ? 'Frakobl Jacdac' : 'Tilslut Jacdac'}
    </button>
  {/key}

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

  button.disconnected {
    border: 1px solid #14b8a6;
    background: white;
    color: #0f766e;
    border-radius: 0.5rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  button.disconnected:hover {
    background: #f0fdfa;
  }

  button.connected {
    border: 1px solid #f59e0b;
    background: white;
    color: #b45309;
    border-radius: 0.5rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  button.connected:hover {
    background: #fffbeb;
  }

  button.compact {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    line-height: 1rem;
  }

  button.regular {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
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
