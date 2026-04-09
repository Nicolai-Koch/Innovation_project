<script lang="ts">
  import { SRV_ILLUMINANCE, SRV_LED, SRV_LIGHT_LEVEL, SRV_MAGNETIC_FIELD_LEVEL } from 'jacdac-ts';
  import type { JDService } from 'jacdac-ts';
  import BaseDialog from '../../components/ui/dialogs/BaseDialog.svelte';
  import { devices as jacdacDevices, connected } from './stores';
  import { stores } from '../stores/Stores';
  import ButtonMonitor from './ButtonMonitor.svelte';
  import LedRing from './LedRing.svelte';
  import LightSensorLedAutomation from './LightSensorLedAutomation.svelte';
  import MagnetSensorLedAutomation from './MagnetSensorLedAutomation.svelte';
  import StandardButton from '../../components/ui/buttons/StandardButton.svelte';
  import { startConnectionProcess } from '../stores/connectDialogStore';
  import Microbits from '../microbit-interfacing/Microbits';

  const devices = stores.getDevices();

  let isOpen = false;
  export let iconOnly = false;
  export let subtle = false;

  $: ledServices = $jacdacDevices.flatMap((device) =>
    device.services().filter((service: JDService) => service.serviceClass === SRV_LED)
  );

  $: lightServices = $jacdacDevices.flatMap((device) =>
    device
      .services()
      .filter(
        (service: JDService) =>
          service.serviceClass === SRV_LIGHT_LEVEL || service.serviceClass === SRV_ILLUMINANCE
      )
  );

  $: magnetServices = $jacdacDevices.flatMap((device) =>
    device
      .services()
      .filter(
        (service: JDService) =>
          service.serviceClass === SRV_MAGNETIC_FIELD_LEVEL
      )
  );
</script>

<button
  class="tools-button"
  class:icon-only={iconOnly}
  class:subtle={subtle}
  on:click={() => (isOpen = true)}
  aria-label="Open Jacdac tools"
  title="Jacdac tools">
  {#if iconOnly}
    <i class="fas fa-cog" />
  {:else}
    Jacdac tools
  {/if}
</button>

<BaseDialog isOpen={isOpen} onClose={() => (isOpen = false)}>
  <div class="tools-dialog" on:click|stopPropagation>
    <div class="tools-header">
      <h2>Jacdac module tests</h2>
      <button class="close-button" on:click={() => (isOpen = false)}>Close</button>
    </div>

    <section class="section connection-section">
      <h3>Forbindelser</h3>
      <div class="connection-grid">
        {#if !$connected}
          <StandardButton onClick={startConnectionProcess}>
            Tilslut micro:bit
          </StandardButton>
        {:else if !$devices.isOutputAssigned}
          <StandardButton onClick={startConnectionProcess}>
            Tilslut output-micro:bit
          </StandardButton>
        {:else}
          <StandardButton onClick={() => Microbits.disconnectInput()} color="warning">
            Frakobl input-micro:bit
          </StandardButton>
          <StandardButton onClick={() => Microbits.disconnectOutput()} color="warning">
            Frakobl output-micro:bit
          </StandardButton>
        {/if}
      </div>
    </section>

    <p class="status" class:online={$connected}>
      {$connected ? 'Bus connected' : 'Bus disconnected'}
    </p>

    <div class="tools-content">
      <section class="section">
        <h3>Buttons</h3>
        <ButtonMonitor />
      </section>

      <section class="section">
        <h3>LED rings</h3>
        {#if ledServices.length === 0}
          <p class="empty-message">No LED ring service detected on the Jacdac bus.</p>
        {:else}
          <div class="led-grid">
            {#each ledServices as service, idx (service.id)}
              <div class="led-card">
                <p class="led-title">LED ring {idx + 1}: {service.device?.friendlyName || service.device?.name || 'Unknown device'}</p>
                <LedRing {service} />
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <section class="section">
        <h3>Light sensor -> LED ring</h3>
        {#if lightServices.length === 0}
          <p class="empty-message">No light sensor service detected on the Jacdac bus.</p>
        {:else if ledServices.length === 0}
          <p class="empty-message">Connect an LED ring service to use this automation.</p>
        {:else}
          <LightSensorLedAutomation {lightServices} {ledServices} />
        {/if}
      </section>

      <section class="section">
        <h3>Magnet sensor -> LED ring</h3>
        {#if magnetServices.length === 0}
          <p class="empty-message">No magnet sensor service detected on the Jacdac bus.</p>
        {:else if ledServices.length === 0}
          <p class="empty-message">Connect an LED ring service to use this automation.</p>
        {:else}
          <MagnetSensorLedAutomation {magnetServices} {ledServices} />
        {/if}
      </section>
    </div>
  </div>
</BaseDialog>

<style>
  .tools-button {
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
    border: 2px solid #1976d2;
    border-radius: 6px;
    background: #2196f3;
    color: white;
    cursor: pointer;
  }

  .tools-button:hover {
    background: #1976d2;
  }

  .tools-button.icon-only {
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tools-button.subtle {
    background: rgba(255, 255, 255, 0.28);
    color: rgba(255, 255, 255, 0.85);
    border-color: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(2px);
  }

  .tools-button.subtle:hover {
    background: rgba(255, 255, 255, 0.45);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.9);
  }

  .tools-dialog {
    width: min(900px, 92vw);
    max-height: 85vh;
    overflow-y: auto;
    background: white;
    border-radius: 10px;
    padding: 1rem;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.2);
  }

  .tools-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .close-button {
    border: 1px solid #ccc;
    background: white;
    border-radius: 6px;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
  }

  .status {
    display: inline-block;
    margin-top: 0.6rem;
    margin-bottom: 0.8rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.8rem;
    background: #ffebee;
    color: #b71c1c;
    border: 1px solid #ffcdd2;
  }

  .status.online {
    background: #e8f5e9;
    color: #1b5e20;
    border-color: #c8e6c9;
  }

  .tools-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1rem;
  }

  .section {
    background: #f7f9fc;
    border: 1px solid #dde5ef;
    border-radius: 8px;
    padding: 0.8rem;
  }

  .connection-section {
    margin-bottom: 1rem;
  }

  .connection-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 0.6rem;
    font-size: 1rem;
  }

  .empty-message {
    margin: 0;
    color: #4e5968;
    font-size: 0.9rem;
  }

  .led-grid {
    display: grid;
    gap: 0.75rem;
  }

  .led-card {
    background: #fff;
    border: 1px solid #d9e1ec;
    border-radius: 6px;
    padding: 0.7rem;
  }

  .led-title {
    margin-top: 0;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #334155;
  }
</style>
