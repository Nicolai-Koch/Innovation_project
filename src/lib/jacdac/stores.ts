import { writable } from 'svelte/store';
import { createUSBBus, CONNECTION_STATE, JDBus, JDDevice } from 'jacdac-ts';
import { CHANGE, DEVICE_ANNOUNCE, DEVICE_CHANGE, SRV_BUTTON } from 'jacdac-ts';
import Microbits from '../microbit-interfacing/Microbits';

// Initialize the Jacdac bus - single instance for entire app
let busInstance: JDBus | null = null;
let isInitialized = false;

function getBus(): JDBus {
  if (!busInstance) {
    busInstance = createUSBBus();
    busInstance.streaming = true;
    // Keep a reference to prevent garbage collection
    (globalThis as any).__jacdacBus = busInstance;
  }
  return busInstance;
}

export const bus: JDBus = getBus();

// Writable stores for reactive state
export const connected = writable(false);
export const devices = writable<JDDevice[]>([]);
export const error = writable<string | null>(null);

function getVisibleDevices(currentBus: JDBus): JDDevice[] {
  // Show only real announced, non-infrastructure devices.
  // This avoids showing the built-in simulator/infrastructure pseudo-device.
  return currentBus.devices({
    announced: true,
    ignoreInfrastructure: true,
  });
}

// Initialize bus listeners (call once on app startup)
export function initializeBus() {
  if (isInitialized) return;
  isInitialized = true;

  const currentBus = getBus();

  // Subscribe to connection state changes
  currentBus.on(CONNECTION_STATE, () => {
    connected.set(currentBus.connected);
    console.log('Jacdac connection state:', currentBus.connected);
  });

  const updateDevices = () => {
    const deviceList = getVisibleDevices(currentBus);
    devices.set(deviceList);
    const serviceClasses = deviceList.flatMap(device =>
      device.services().map(service => `0x${service.serviceClass.toString(16)}`)
    );
    const buttonDevices = deviceList.filter(device => device.hasService(SRV_BUTTON)).length;
    console.log('Devices updated (real only):', deviceList.length, serviceClasses);
    console.log('Jacdac button devices detected:', buttonDevices);
  };

  // Subscribe to canonical bus change events.
  currentBus.on(CHANGE, updateDevices);
  currentBus.on(DEVICE_ANNOUNCE, updateDevices);
  currentBus.on(DEVICE_CHANGE, updateDevices);

  // Set initial state
  connected.set(currentBus.connected);
  updateDevices();
}

// Connect to the bus
export async function connectToBus() {
  try {
    error.set(null);
    const currentBus = getBus();
    console.log('Starting Jacdac connection...');

    // cctd-ml-machine also uses WebUSB for firmware/USB flows.
    // If that controller is still connected, Jacdac cannot claim the same USB device.
    try {
      await Microbits.unlinkMicrobit();
    } catch {
      // Ignore when no linked USB micro:bit exists.
    }

    // Match Astro's known-working flow: hard reset then connect.
    await currentBus.disconnect();
    await currentBus.connect();
    console.log('Connected to Jacdac bus');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error.set(message);
    console.error('Failed to connect to Jacdac bus:', err);
  }
}

// Disconnect from the bus
export async function disconnectFromBus() {
  try {
    const currentBus = getBus();
    console.log('Starting Jacdac disconnection...');
    
    await currentBus.disconnect();
    error.set(null);
    console.log('Disconnected from Jacdac bus');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error.set(message);
    console.error('Failed to disconnect from Jacdac bus:', err);
  }
}
