<script lang="ts">
  import { onMount } from 'svelte';
  import { SRV_BUTTON, CHANGE, ButtonReg, ButtonEvent } from 'jacdac-ts';
  import type { JDService, JDRegister, JDDevice } from 'jacdac-ts';
  import { connected, devices as jacdacDevices } from './stores';

  interface ButtonState {
    service: JDService;
    pressedRegister: JDRegister;
    pressEventCount: number;
    pressed: boolean;
    previousPressed: boolean;
    pressCount: number;
    label: string;
  }

  let buttons: ButtonState[] = [];
  let knownDevices: JDDevice[] = [];
  let unsubscribers: (() => void)[] = [];
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let connectionHint = 'Waiting for Jacdac connection';
  let connectedButtonCount = 0;

  $: totalPressCount = buttons.reduce((sum, buttonState) => sum + buttonState.pressCount, 0);

  function cleanup() {
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];

    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
  }

  async function refreshPressedStates() {
    await Promise.all(
      buttons.map(async buttonState => {
        try {
          await buttonState.pressedRegister.refresh(true);
          const nextPressed = !!buttonState.pressedRegister.boolValue;
          // Count only on rising edge so a held button is counted once.
          if (nextPressed && !buttonState.previousPressed) {
            buttonState.pressCount += 1;
          }
          buttonState.pressed = nextPressed;
          buttonState.previousPressed = nextPressed;
        } catch {
          // Ignore transient refresh errors while devices reconnect.
        }
      })
    );
    buttons = [...buttons];
  }

  async function updateButtonList() {
    cleanup();
    buttons = [];
    connectedButtonCount = 0;

    if (!$connected) return;

    // Find button services from already enumerated Jacdac devices.
    try {
      const buttonServices: JDService[] = [];
      knownDevices.forEach(device => {
        if (!device.hasService(SRV_BUTTON)) return;
        const service = device.services().find(s => s.serviceClass === SRV_BUTTON);
        if (service) buttonServices.push(service);
      });

      buttonServices.forEach((service: JDService) => {
        const pressedRegister = service.register(ButtonReg.Pressed);
        const pressEvent = service.event(ButtonEvent.Down);
        const buttonState: ButtonState = {
          service,
          pressedRegister,
          pressEventCount: pressEvent?.count || 0,
          pressed: false,
          previousPressed: false,
          pressCount: 0,
          label: service.device?.friendlyName || service.device?.name || 'Unknown Device',
        };

        buttons.push(buttonState);

        // Update state when the register changes.
        const unsubscribe = pressedRegister.subscribe(CHANGE, () => {
          const nextPressed = !!pressedRegister.boolValue;
          if (nextPressed && !buttonState.previousPressed && buttonState.pressEventCount === 0) {
            buttonState.pressCount += 1;
          }
          buttonState.pressed = nextPressed;
          buttonState.previousPressed = nextPressed;
          buttons = [...buttons];
        });
        unsubscribers.push(unsubscribe);

        if (pressEvent) {
          const unsubscribePressEvent = pressEvent.subscribe(CHANGE, () => {
            buttonState.pressEventCount = pressEvent.count || 0;
            // Prefer Jacdac event count when available for accurate button press counting.
            buttonState.pressCount = buttonState.pressEventCount;
            buttons = [...buttons];
          });
          unsubscribers.push(unsubscribePressEvent);
        }
      });

      connectedButtonCount = buttonServices.length;

      await refreshPressedStates();

      // Polling improves reliability for button modules that do not emit frequent register updates.
      refreshTimer = setInterval(() => {
        void refreshPressedStates();
      }, 250);

      buttons = [...buttons];
    } catch (err) {
      console.error('Error reading buttons:', err);
    }
  }

  onMount(() => {
    const unsubscribeDevices = jacdacDevices.subscribe((deviceList) => {
      knownDevices = [...deviceList];
      if ($connected) void updateButtonList();
    });

    // Subscribe to connected state changes
    const unsubscribe = connected.subscribe(async (isConnected) => {
      if (isConnected) {
        connectionHint = 'Connected. Press a Jacdac button to test input.';
        await updateButtonList();
      } else {
        cleanup();
        connectedButtonCount = 0;
        connectionHint = 'Not connected. Press Connect to listen for button presses.';
      }
    });

    return () => {
      unsubscribeDevices();
      unsubscribe();
      cleanup();
    };
  });
</script>

<div class="button-monitor">
  <h3>Jacdac Buttons</h3>
  <div class="connection-state" class:online={$connected}>
    {$connected ? 'Bus connected' : 'Bus disconnected'}
  </div>
  <div class="summary-row">
    <span>Connected buttons: {connectedButtonCount}</span>
    <span>Total presses: {totalPressCount}</span>
  </div>

  {#if buttons.length === 0}
    <div class="status-message">
      {connectionHint}
    </div>
  {:else}
    <div class="buttons-grid">
      {#each buttons as buttonState, idx (idx)}
        <div class="button-display" class:pressed={buttonState.pressed}>
          <div class="button-label">{buttonState.label}</div>
          <div class="button-indicator">
            {buttonState.pressed ? 'PRESSED' : 'Released'}
          </div>
          <div class="button-count">Count: {buttonState.pressCount}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .button-monitor {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
    min-width: 200px;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #333;
  }

  .status-message {
    padding: 1rem;
    background: #e3f2fd;
    border: 1px solid #2196f3;
    border-radius: 4px;
    color: #1565c0;
    font-size: 0.875rem;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
    color: #333;
  }

  .connection-state {
    display: inline-block;
    margin-bottom: 0.75rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    border-radius: 999px;
    background: #ffebee;
    color: #b71c1c;
    border: 1px solid #ffcdd2;
  }

  .connection-state.online {
    background: #e8f5e9;
    color: #1b5e20;
    border-color: #c8e6c9;
  }

  .buttons-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }

  .button-display {
    padding: 1rem;
    border: 2px solid #999;
    border-radius: 8px;
    background: white;
    text-align: center;
    transition: all 0.1s;
  }

  .button-display.pressed {
    background: #ffcdd2;
    border-color: #f44336;
    box-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
  }

  .button-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #666;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
  }

  .button-indicator {
    font-size: 0.9rem;
    font-weight: bold;
    color: #333;
  }

  .button-count {
    margin-top: 0.4rem;
    font-size: 0.8rem;
    color: #444;
  }

  .button-display.pressed .button-indicator {
    color: #f44336;
  }
</style>
