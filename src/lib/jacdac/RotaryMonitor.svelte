<script lang="ts">
  import { onMount } from 'svelte';
  import {
    CHANGE,
    PotentiometerReg,
    RotaryEncoderReg,
    SRV_POTENTIOMETER,
    SRV_ROTARY_ENCODER,
  } from 'jacdac-ts';
  import type { JDDevice, JDRegister, JDService } from 'jacdac-ts';
  import { connected, devices as jacdacDevices } from './stores';

  type RotaryState = {
    service: JDService;
    register: JDRegister;
    kind: 'encoder' | 'potentiometer';
    label: string;
    rawValue: number;
  };

  let states: RotaryState[] = [];
  let knownDevices: JDDevice[] = [];
  let unsubscribers: (() => void)[] = [];
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  function cleanup() {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    unsubscribers = [];

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  function getRawValue(state: RotaryState) {
    if (state.kind === 'encoder') {
      return state.register.intValue ?? 0;
    }
    return state.register.uintValue ?? 0;
  }

  function displayValue(state: RotaryState) {
    if (state.kind === 'encoder') {
      return `${state.rawValue}`;
    }

    const ratio = Math.max(0, Math.min(1, state.rawValue / 65535));
    return `${state.rawValue} (${(ratio * 100).toFixed(1)}%)`;
  }

  async function refreshStates() {
    await Promise.all(
      states.map(async state => {
        try {
          await state.register.refresh(true);
          state.rawValue = getRawValue(state);
        } catch {
          // Ignore transient errors during reconnects.
        }
      })
    );
    states = [...states];
  }

  function buildStateList() {
    cleanup();
    states = [];

    if (!$connected) {
      return;
    }

    knownDevices.forEach(device => {
      device.services().forEach(service => {
        if (service.serviceClass === SRV_ROTARY_ENCODER) {
          const register = service.register(RotaryEncoderReg.Position);
          const state: RotaryState = {
            service,
            register,
            kind: 'encoder',
            label: service.device?.friendlyName || service.device?.name || 'Unknown encoder',
            rawValue: 0,
          };
          states.push(state);

          const unsubscribe = register.subscribe(CHANGE, () => {
            state.rawValue = getRawValue(state);
            states = [...states];
          });
          unsubscribers.push(unsubscribe);
          return;
        }

        if (service.serviceClass === SRV_POTENTIOMETER) {
          const register = service.register(PotentiometerReg.Position);
          const state: RotaryState = {
            service,
            register,
            kind: 'potentiometer',
            label: service.device?.friendlyName || service.device?.name || 'Unknown potentiometer',
            rawValue: 0,
          };
          states.push(state);

          const unsubscribe = register.subscribe(CHANGE, () => {
            state.rawValue = getRawValue(state);
            states = [...states];
          });
          unsubscribers.push(unsubscribe);
        }
      });
    });

    void refreshStates();
    pollTimer = setInterval(() => {
      void refreshStates();
    }, 300);
  }

  onMount(() => {
    const unsubscribeDevices = jacdacDevices.subscribe(deviceList => {
      knownDevices = [...deviceList];
      if ($connected) {
        buildStateList();
      }
    });

    const unsubscribeConnected = connected.subscribe(isConnected => {
      if (isConnected) {
        buildStateList();
      } else {
        cleanup();
        states = [];
      }
    });

    return () => {
      unsubscribeDevices();
      unsubscribeConnected();
      cleanup();
    };
  });
</script>

<div class="rotary-monitor">
  {#if states.length === 0}
    <p class="status">Ingen rotary/potentiometer registreret endnu.</p>
  {:else}
    <div class="grid">
      {#each states as state (state.service.id)}
        <div class="card">
          <p class="title">{state.label}</p>
          <p class="kind">{state.kind === 'encoder' ? 'Rotary encoder' : 'Rotary potentiometer'}</p>
          <p class="value">{displayValue(state)}</p>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .rotary-monitor {
    margin-top: 0.25rem;
  }

  .status {
    margin: 0;
    color: #4e5968;
    font-size: 0.9rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 0.6rem;
  }

  .card {
    border: 1px solid #d9e1ec;
    border-radius: 8px;
    background: #fff;
    padding: 0.6rem 0.7rem;
  }

  .title {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 700;
    color: #1d3557;
  }

  .kind {
    margin: 0.15rem 0 0;
    font-size: 0.78rem;
    color: #4e5968;
  }

  .value {
    margin: 0.35rem 0 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: #0f766e;
  }
</style>
