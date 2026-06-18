<script setup lang="ts">
import Chip from 'primevue/chip'
import MultiSelect from 'primevue/multiselect'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  disabled?: boolean
  modelValue: string[]
  options: string[]
}>()

const emit = defineEmits<{
  cancel: []
  save: [services: string[]]
}>()

const draft = ref<string[]>([])
const customService = ref('')

const normalizedOptions = computed(() => normalize([...props.options, ...props.modelValue]))
const changed = computed(() => normalize(draft.value).join('\n') !== normalize(props.modelValue).join('\n'))

watch(
  () => props.modelValue,
  (value) => {
    draft.value = [...value]
  },
  { immediate: true },
)

function addCustomService(): void {
  const service = customService.value.trim()
  if (service.length === 0) return

  draft.value = normalize([...draft.value, service])
  customService.value = ''
}

function removeService(service: string): void {
  draft.value = draft.value.filter((candidate) => candidate !== service)
}

function reset(): void {
  draft.value = [...props.modelValue]
  customService.value = ''
  emit('cancel')
}

function save(): void {
  emit('save', normalize(draft.value))
}

function normalize(services: string[]): string[] {
  return Array.from(new Set(services.map((service) => service.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}
</script>

<template>
  <div class="min-w-64 space-y-2" data-testid="service-permissions-editor">
    <MultiSelect
      v-model="draft"
      :disabled="disabled"
      :options="normalizedOptions"
      display="chip"
      filter
      placeholder="Select services"
      class="w-full text-sm"
      data-testid="service-permissions-select"
    />

    <div class="flex flex-wrap gap-1">
      <Chip
        v-for="service in draft"
        :key="service"
        :label="service"
        removable
        :data-testid="`service-chip-${service}`"
        @remove="removeService(service)"
      />
    </div>

    <div class="flex gap-2">
      <input
        v-model="customService"
        :disabled="disabled"
        type="text"
        class="min-w-0 flex-1 rounded border border-[var(--color-surface-border)] bg-transparent px-2 py-1 text-xs"
        data-testid="service-permissions-input"
        placeholder="Add service"
        @keydown.enter.prevent="addCustomService"
      >
      <button
        type="button"
        class="
          rounded border border-[var(--color-surface-border)] px-2 py-1 text-xs
          text-[var(--color-text-primary)] disabled:opacity-50
        "
        :disabled="disabled || customService.trim().length === 0"
        data-testid="service-permissions-add"
        @click="addCustomService"
      >
        Add
      </button>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        class="rounded bg-[var(--color-accent)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        :disabled="disabled || !changed"
        data-testid="service-permissions-save"
        @click="save"
      >
        Save
      </button>
      <button
        type="button"
        class="rounded border border-[var(--color-surface-border)] px-2 py-1 text-xs disabled:opacity-50"
        :disabled="disabled || !changed"
        data-testid="service-permissions-cancel"
        @click="reset"
      >
        Cancel
      </button>
    </div>
  </div>
</template>
