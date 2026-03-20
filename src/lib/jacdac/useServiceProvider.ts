import {
  serviceSpecificationFromName,
  serviceProviderDefinitionFromServiceClass,
  addServiceProvider,
  JDBus,
} from 'jacdac-ts';
import { onMount, onDestroy } from 'svelte';

interface ServiceProviderOptions {
  serviceClass?: number;
  serviceName?: string;
}

/**
 * Svelte utility to manage service providers on the bus.
 * Returns a function that can be called to update the service provider state.
 */
export function useServiceProvider(
  options: ServiceProviderOptions | undefined,
  bus: JDBus
) {
  let provider: any = null;

  // Start the service provider if options are provided
  if (options?.serviceClass || options?.serviceName) {
    const def = serviceProviderDefinitionFromServiceClass(
      options.serviceClass ||
        serviceSpecificationFromName(options.serviceName)?.classIdentifier
    );
    if (def) {
      provider = addServiceProvider(bus, def);
    }
  }

  // Cleanup on destroy
  onDestroy(() => {
    if (provider) {
      bus.removeServiceProvider(provider);
    }
  });

  return provider;
}
