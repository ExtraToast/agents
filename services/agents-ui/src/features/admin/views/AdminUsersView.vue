<script setup lang="ts">
import type { AdminUserResponse } from '../types'
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import ConfirmDialog from 'primevue/confirmdialog'
import DataTable from 'primevue/datatable'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from '@/lib/vueWebCommons'
import AdminServicePermissionsEditor from '../components/ServicePermissionsEditor.vue'
import { useAdminStore } from '../stores/admin'
import { assignableRoles } from '../types'

const store = useAdminStore()
const toast = useToast()
const confirm = useConfirm()

const mutatingIds = ref<Set<string>>(new Set())
const roleSelections = ref<Record<string, string>>({})

const serviceOptions = computed(() =>
  Array.from(new Set(store.users.flatMap((user) => user.servicePermissions))).sort((a, b) => a.localeCompare(b)),
)

onMounted(async () => {
  try {
    await store.listUsers()
    syncRoleSelections()
  } catch (e) {
    toast.errorFromCatch('Could not load admin users', e)
  }
})

function syncRoleSelections(): void {
  roleSelections.value = Object.fromEntries(store.users.map((user) => [user.id, user.role]))
}

function displayName(user: AdminUserResponse): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function isMutating(id: string): boolean {
  return mutatingIds.value.has(id)
}

function setMutating(id: string, mutating: boolean): void {
  const next = new Set(mutatingIds.value)
  if (mutating) next.add(id)
  else next.delete(id)
  mutatingIds.value = next
}

function onRoleSelected(user: AdminUserResponse, role: string): void {
  if (role === user.role) return

  confirm.require({
    header: 'Change role',
    message: `Change ${displayName(user)} from ${user.role} to ${role}?`,
    acceptLabel: 'Change',
    rejectLabel: 'Cancel',
    accept: () => {
      void applyRole(user, role)
    },
    reject: () => {
      roleSelections.value = { ...roleSelections.value, [user.id]: user.role }
    },
  })
}

async function applyRole(user: AdminUserResponse, role: string): Promise<void> {
  setMutating(user.id, true)
  try {
    const updated = await store.updateRole(user.id, role)
    roleSelections.value = { ...roleSelections.value, [updated.id]: updated.role }
    toast.success('Role updated', `${displayName(updated)} is now ${updated.role}.`)
  } catch (e) {
    roleSelections.value = { ...roleSelections.value, [user.id]: user.role }
    toast.errorFromCatch('Could not update user role', e)
  } finally {
    setMutating(user.id, false)
  }
}

async function onServicesSave(user: AdminUserResponse, services: string[]): Promise<void> {
  setMutating(user.id, true)
  try {
    const updated = await store.updateServicePermissions(user.id, services)
    toast.success(
      'Services updated',
      `${displayName(updated)} can access ${updated.servicePermissions.length} services.`,
    )
  } catch (e) {
    toast.errorFromCatch('Could not update service permissions', e)
  } finally {
    setMutating(user.id, false)
  }
}

function onDelete(user: AdminUserResponse): void {
  confirm.require({
    header: 'Delete user',
    message: `Delete ${displayName(user)}? This cannot be undone.`,
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: () => {
      void deleteUser(user)
    },
  })
}

async function deleteUser(user: AdminUserResponse): Promise<void> {
  setMutating(user.id, true)
  try {
    await store.deleteUser(user.id)
    toast.success('User deleted', displayName(user))
  } catch (e) {
    toast.errorFromCatch('Could not delete user', e)
  } finally {
    setMutating(user.id, false)
  }
}
</script>

<template>
  <div class="max-w-7xl mx-auto p-6" data-testid="admin-users-view">
    <header class="mb-6">
      <h1 class="text-2xl font-bold">Users</h1>
      <p class="mt-1 text-sm text-[var(--color-text-muted)]">
        Manage account roles and service permissions for the fleet.
      </p>
    </header>

    <ConfirmDialog />

    <p v-if="store.error" class="mb-4 text-sm text-red-400" data-testid="admin-users-error">{{ store.error }}</p>

    <DataTable
      :value="store.users"
      :loading="store.loading"
      data-key="id"
      striped-rows
      responsive-layout="scroll"
      class="text-sm"
      data-testid="admin-users-table"
    >
      <template #empty>
        <div class="p-6 text-center text-[var(--color-text-muted)]" data-testid="admin-users-empty">
          No users found.
        </div>
      </template>
      <template #loading>
        <div class="p-6 text-center text-[var(--color-text-muted)]" data-testid="admin-users-loading">
          Loading users…
        </div>
      </template>

      <Column field="username" header="Username">
        <template #body="{ data }">
          <div :data-testid="`admin-user-${data.id}`">
            <div class="font-medium">{{ data.username }}</div>
            <div class="text-xs text-[var(--color-text-muted)]">{{ displayName(data) }}</div>
          </div>
        </template>
      </Column>

      <Column field="email" header="Email" />

      <Column field="role" header="Role">
        <template #body="{ data }">
          <Select
            :model-value="roleSelections[data.id] ?? data.role"
            :options="[...assignableRoles]"
            :disabled="isMutating(data.id)"
            class="min-w-32"
            :data-testid="`admin-role-${data.id}`"
            @update:model-value="(role) => onRoleSelected(data, String(role))"
          />
        </template>
      </Column>

      <Column field="emailConfirmed" header="Email confirmed">
        <template #body="{ data }">
          <span
            class="rounded px-2 py-1 text-xs"
            :class="data.emailConfirmed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'"
          >
            {{ data.emailConfirmed ? 'Yes' : 'No' }}
          </span>
        </template>
      </Column>

      <Column field="totpEnabled" header="TOTP">
        <template #body="{ data }">
          <span
            class="rounded px-2 py-1 text-xs"
            :class="data.totpEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'"
          >
            {{ data.totpEnabled ? 'Enabled' : 'Disabled' }}
          </span>
        </template>
      </Column>

      <Column field="servicePermissions" header="Services">
        <template #body="{ data }">
          <AdminServicePermissionsEditor
            :model-value="data.servicePermissions"
            :options="serviceOptions"
            :disabled="isMutating(data.id)"
            @save="(services) => onServicesSave(data, services)"
          />
        </template>
      </Column>

      <Column field="createdAt" header="Created">
        <template #body="{ data }">
          <span class="text-xs text-[var(--color-text-muted)]">{{ formatDate(data.createdAt) }}</span>
        </template>
      </Column>

      <Column header="Actions">
        <template #body="{ data }">
          <Button
            severity="danger"
            size="small"
            label="Delete"
            :loading="isMutating(data.id)"
            :data-testid="`admin-delete-${data.id}`"
            @click="onDelete(data)"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>
