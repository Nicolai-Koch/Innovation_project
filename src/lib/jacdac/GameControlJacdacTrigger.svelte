<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { CHANGE, ButtonEvent, ButtonReg, SRV_BUTTON } from 'jacdac-ts';
  import type { JDDevice, JDService } from 'jacdac-ts';
  import { connected, devices as jacdacDevices } from './stores';
  import { GamePhase, gamePhase, setGamePhase } from '../stores/TeamGameStore';

  let knownDevices: JDDevice[] = [];
  let unsubscribers: (() => void)[] = [];
  let lastToggleAt = new Map<string, number>();

  function cleanupSubscriptions() {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    unsubscribers = [];
  }

  function getButtonServices(): JDService[] {
    return knownDevices.flatMap(device =>
      device.services().filter((service: JDService) => service.serviceClass === SRV_BUTTON),
    );
  }

  function toggleGamePhase() {
    if ($gamePhase === GamePhase.Training || $gamePhase === GamePhase.Setup) {
      return;
    }

    if ($gamePhase === GamePhase.Playing) {
      setGamePhase(GamePhase.Paused);
      return;
    }
    setGamePhase(GamePhase.Playing);
  }

  function toggleWithCooldown(buttonService: JDService) {
    const now = Date.now();
    const key = buttonService.id;
    const last = lastToggleAt.get(key) ?? 0;
    if (now - last < 250) {
      return;
    }

    lastToggleAt.set(key, now);
    toggleGamePhase();
  }

  function subscribeToButtons() {
    cleanupSubscriptions();

    if (!get(connected)) {
      return;
    }

    const buttonServices = getButtonServices();
    buttonServices.forEach(buttonService => {
      const downEvent = buttonService.event(ButtonEvent.Down);
      if (downEvent) {
        const unsubscribeEvent = downEvent.subscribe(CHANGE, () => {
          toggleWithCooldown(buttonService);
        });
        unsubscribers.push(unsubscribeEvent);
      }

      const pressedRegister = buttonService.register(ButtonReg.Pressed);
      const unsubscribeRegister = pressedRegister.subscribe(CHANGE, () => {
        if (pressedRegister.boolValue) {
          toggleWithCooldown(buttonService);
        }
      });
      unsubscribers.push(unsubscribeRegister);
    });
  }

  onMount(() => {
    const unsubscribeDevices = jacdacDevices.subscribe(deviceList => {
      knownDevices = [...deviceList];
      if (get(connected)) {
        subscribeToButtons();
      }
    });

    const unsubscribeConnected = connected.subscribe(isConnected => {
      if (isConnected) {
        subscribeToButtons();
      } else {
        cleanupSubscriptions();
      }
    });

    return () => {
      unsubscribeDevices();
      unsubscribeConnected();
      cleanupSubscriptions();
    };
  });
</script>

<div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
  <p class="font-semibold">Spillerknap aktiv</p>
  <p>Tryk på en Jacdac-knap for at starte eller pause spillet. Under træning gør den ikke noget.</p>
</div>
