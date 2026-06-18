<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <main class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
    <section class="w-full rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 shadow-sm">
      <header class="mb-6">
        <h1 class="text-2xl font-bold">{{ title }}</h1>
        <p v-if="subtitle" class="mt-2 text-sm text-[var(--color-text-muted)]">{{ subtitle }}</p>
      </header>
      <slot />
    </section>
  </main>
</template>
