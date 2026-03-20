<script lang="ts">
  import { onMount } from 'svelte';
  import { devices, connected } from './stores';
  import type { JDService } from 'jacdac-ts';

  let sortedDevices: any[] = [];

  onMount(() => {
    const unsubscribe = devices.subscribe((deviceList) => {
      sortedDevices = deviceList.sort((a, b) => a.name.localeCompare(b.name));
    });

    return unsubscribe;
  });
</script>

<div class="devices-container">
  <h3>Jacdac Devices: {sortedDevices.length}</h3>

  {#if !$connected}
    <div class="no-connection">
      <p>Connect to a Jacdac bus to see devices</p>
    </div>
  {:else if sortedDevices.length === 0}
    <div class="no-devices">
      <p>No devices found. Check your micro:bit connection.</p>
    </div>
  {:else}
    <ul class="devices-list">
      {#each sortedDevices as device (device.id)}
        <li class="device-item">
          <div class="device-header">
            <strong>{device.name}</strong>
            <span class="device-id">{device.id.substring(0, 8)}</span>
          </div>
          <div class="device-description">
            {device.describe()}
          </div>

          {#if device.services() && device.services().length > 0}
            <ul class="services-list">
              {#each device.services() as service (service.id)}
                <li class="service-item">
                  <span class="service-name">{service.name}</span>
                  <span class="service-class">({service.serviceClass})</span>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .devices-container {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #333;
  }

  .no-connection,
  .no-devices {
    padding: 1rem;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 4px;
    color: #856404;
  }

  .no-devices {
    background: #e3f2fd;
    border-color: #2196f3;
    color: #1565c0;
  }

  .devices-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .device-item {
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 0.5rem;
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .device-id {
    font-size: 0.875rem;
    color: #999;
    font-family: monospace;
  }

  .device-description {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.5rem;
  }

  .services-list {
    list-style: none;
    padding: 0;
    margin: 0;
    padding-left: 1rem;
    border-left: 2px solid #ddd;
  }

  .service-item {
    font-size: 0.875rem;
    color: #555;
    padding: 0.25rem 0;
  }

  .service-name {
    font-weight: 500;
    color: #333;
  }

  .service-class {
    color: #999;
    margin-left: 0.25rem;
  }
</style>
