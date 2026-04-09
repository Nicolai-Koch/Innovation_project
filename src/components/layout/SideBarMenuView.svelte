<!--
  (c) 2023-2025, Center for Computational Thinking and Design at Aarhus University and contributors
 
  SPDX-License-Identifier: MIT
 -->

<!-- Left-hand side menu -->
<script lang="ts">
  import { get } from 'svelte/store';
  import type { MenuProperties } from '../sidemenu/Menus';
  import { currentPath, navigate, Paths } from '../../router/Router';
  import MediaQuery from './MediaQuery.svelte';
  import Menus from '../sidemenu/Menus';
  import MenuButton from '../sidemenu/MenuButton.svelte';
  import { isLoading } from '../../lib/stores/ApplicationState';
  import JacdacToolsPopup from '../../lib/jacdac/JacdacToolsPopup.svelte';

  $: shouldBeExpanded = (menuProps: MenuProperties) => {
    let path = $currentPath;
    if (menuProps.navigationPath === path) {
      return true;
    }
    if (menuProps.additionalExpandPaths === undefined) {
      return false;
    }
    return menuProps.additionalExpandPaths.includes(path);
  };

  const onLoad = () => {
    $isLoading = false;
  };

  const sideMenuNavigationDisabled = true;
</script>

<div
  class="bg-gradient-to-b from-primary via-secondary to-primaryaccent relative flex flex-col w-full shadow-2xl">
  <!-- flush top bar -->
  <div class="h-12 shadow-md w-full flex justify-center">
    <MediaQuery query="(max-width: 1500px)" let:matches={isSmall}>
      <p
        class="text-secondarytext font-extrabold self-center"
        class:text-3xl={!isSmall}
        class:text-2xl={isSmall}>
        AI Træning
      </p>
      <div class="text-white self-center ml-4 focus:outline-none">
        <button
          class="rounded hover:bg-white
						   hover:bg-opacity-10 duration-100
						   select-none outline-none"
          on:click={() => navigate(Paths.HOME)}>
          <i class="fas fa-home text-2xl outline-none" />
        </button>
      </div>
    </MediaQuery>
  </div>

  <!-- Menu -->
  <div class="p-5 pl-5 pr-5">
    <div class="absolute bottom-15 -left-2">
      <img alt="decoration arrows" src="/imgs/partial_red_arrows.svg" width="225px" />
    </div>

    <div class="relative">
      {#each get(Menus.getMenuStore()) as menu, id}
        <MenuButton
          tooltipOffset={menu.tooltipOffset}
          onClickFunction={() => {
            if (!sideMenuNavigationDisabled && !(menu.disabled ?? false)) {
              navigate(menu.navigationPath);
            }
          }}
          title={menu.title}
          helpTitle={menu.infoBubbleTitle}
          helpDescription={menu.infoBubbleContent}
          showInfo={menu.showInfo ?? true}
          underlineTitle={menu.underlineTitle ?? true}
          disabled={sideMenuNavigationDisabled || (menu.disabled ?? false)}
          isExpanded={shouldBeExpanded(menu)}>
          <svelte:component
            this={shouldBeExpanded(menu)
              ? menu.expandedButtonContent
              : menu.collapsedButtonContent} />
        </MenuButton>
        {#if id !== get(Menus.getMenuStore()).length - 1}
          <div class="text-center ml-auto mr-auto mb-1 mt-1">
            <img
              on:load={onLoad}
              class="m-auto"
              src="/imgs/down_arrow.svg"
              alt="down arrow icon"
              width="30px" />
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <div class="absolute left-2 bottom-2 z-20 opacity-55 hover:opacity-100 transition-opacity duration-150">
    <JacdacToolsPopup iconOnly={true} subtle={true} />
  </div>
</div>
