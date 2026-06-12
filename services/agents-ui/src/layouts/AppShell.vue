<script setup lang="ts">
import type { AppShellNavItem } from '@/lib/vueWebCommons'
import { agentsThemeOptions, AppShell as CommonsAppShell } from '@/lib/vueWebCommons'

const navItems: AppShellNavItem[] = [
  {
    label: 'Sessions',
    to: '/sessions',
    testid: 'nav-sessions',
    icon: 'terminal',
    children: [
      { label: 'Workspace', to: '/sessions?tab=workspace', testid: 'nav-sessions-workspace', icon: 'window' },
      { label: 'Scratch', to: '/sessions?tab=scratch', testid: 'nav-sessions-scratch', icon: 'terminal' },
      { label: 'Chat', to: '/sessions?tab=chat', testid: 'nav-sessions-chat', icon: 'chat' },
    ],
  },
  { label: 'Projects', to: '/projects', testid: 'nav-projects', icon: 'folder' },
  { label: 'Repositories', to: '/repositories', testid: 'nav-repositories', icon: 'git' },
]
</script>

<template>
  <CommonsAppShell
    brand-main="agents"
    layout="rail"
    new-action-label="New session"
    new-action-to="/sessions?tab=workspace&new=1"
    :nav-items="navItems"
    :theme-options="agentsThemeOptions"
  >
    <slot />
  </CommonsAppShell>
</template>
