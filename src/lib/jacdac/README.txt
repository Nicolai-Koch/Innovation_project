JACDAC INTEGRATION FOR SVELTE/ML-MACHINE
========================================

This folder contains Svelte components for Jacdac device integration.

KEY CONCEPTS:
- The Jacdac bus (JDBus) is where all Jacdac devices are found. From the web browser,
  we connect to the physical Jacdac bus via WebUSB. This requires a user gesture (like
  pushing the connect button). See ConnectButton.svelte. The bus may come and go, as the 
  user disconnects the micro:bit from USB. We subscribe to changes to the bus status to 
  reflect the current state. See https://jacdac.github.io/jacdac-docs/clients/javascript/jdom/bus/

- We can enumerate the devices on the bus: see Devices.svelte. Devices may come and go 
  so we also subscribe to changes on the bus. 
  See https://jacdac.github.io/jacdac-docs/clients/javascript/jdom/device/

- Each device has a list of services that it supports. Each service has a unique id, defined
  in jacdac-ts. For example, the button service's id is SRV_BUTTON. Every device must implement
  the control service: SRV_CONTROL. 
  https://jacdac.github.io/jacdac-docs/clients/javascript/jdom/service/

- Each service is defined by registers, commands and events.
  See https://jacdac.github.io/jacdac-docs/clients/javascript/jdom/register/

FILES:
------

stores.ts
  - Central state management using Svelte stores
  - Exports the JDBus instance and writable stores for:
    * connected (boolean) - connection state
    * devices (JDDevice[]) - list of devices
    * error (string | null) - error messages
  - Exports functions:
    * initializeBus() - set up bus listeners (call this once on app start)
    * connectToBus() - connect to the physical bus via WebUSB
    * disconnectFromBus() - disconnect from the bus

ConnectButton.svelte
  - Provides a button to connect/disconnect from the Jacdac bus
  - Shows connection status and error messages
  - Must be placed near the top level of your app

Devices.svelte
  - Displays a list of connected devices and their services
  - Automatically updates when devices connect/disconnect

SimulatorButton.svelte / SimulatorToolbar.svelte
  - Allows testing without hardware
  - Creates simulated Jacdac services on the bus
  - Useful for development and testing

LedRing.svelte
  - Example component demonstrating interaction with a Jacdac service
  - Shows how to read registers and send commands

useServiceProvider.ts
  - Utility for creating simulated services on the bus
  - Used by SimulatorButton

USAGE IN YOUR APP:
------------------

1. Import and use in your main App.svelte:
   import ConnectButton from '$lib/jacdac/ConnectButton.svelte';
   import Devices from '$lib/jacdac/Devices.svelte';
   
   <ConnectButton />
   <Devices />

2. Subscribe to devices store to access device data:
   import { devices } from '$lib/jacdac/stores';
   
   {#each $devices as device (device.id)}
     ...
   {/each}

3. For more advanced usage, import the bus and services:
   import { bus } from '$lib/jacdac/stores';
   
   // Find a specific service type
   const buttons = bus.services({ serviceClass: SRV_BUTTON });

IMPORTANT NOTES:
----------------
- The bus.connect() call must happen directly from a user gesture (click handler)
  to avoid browser WebUSB permission issues. Avoid awaiting other async work first.
- Always register bus event listeners in onMount() or reactive statements with cleanup
  in onDestroy() to avoid duplicate listeners.
- Make sure to surface connection errors in the UI so users know if WebUSB is
  unavailable or the device is not connected.

For more info: https://jacdac.github.io/jacdac-docs/clients/javascript/
