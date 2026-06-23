<script setup lang="ts">
import type { CredentialProvider, CredentialStatus } from '../types'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Card, useToast } from '@/lib/vueWebCommons'
import { useCredentialsStore } from '../stores/credentials'
import { isTerminalPhase } from '../types'

interface ProviderMeta {
  id: CredentialProvider
  label: string
  /** What the CLI is, in the operator's words. */
  blurb: string
  /** Primary-action verb shown on the idle button. */
  action: string
  /** Per-provider accent so the two cards are not interchangeable. */
  badge: string
  accent: string
}

const store = useCredentialsStore()
const toast = useToast()

const providers: ProviderMeta[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    blurb: 'The Claude Code CLI the agent runners share.',
    action: 'Sign in to Claude Code',
    badge: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    accent: 'bg-amber-500 hover:bg-amber-400',
  },
  {
    id: 'codex',
    label: 'Codex',
    blurb: 'The OpenAI Codex CLI the agent runners share.',
    action: 'Connect Codex',
    badge: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
    accent: 'bg-sky-500 hover:bg-sky-400',
  },
]

const code = ref<Record<CredentialProvider, string>>({ claude: '', codex: '' })

const phaseLabel: Record<string, string> = {
  starting: 'Starting the CLI…',
  finalizing: 'Saving credentials to Vault…',
}

function connected(p: CredentialProvider): boolean {
  return store.stored[p]?.exists === true
}

function formatWhen(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const min = Math.round((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day} d ago`
  return d.toLocaleDateString()
}

function checkLine(p: CredentialProvider): string {
  const s: CredentialStatus | null = store.stored[p]
  if (!s) return 'Checking…'
  if (!s.exists) return 'No credentials stored yet'
  const when = formatWhen(s.updatedAt)
  const who = s.updatedBy ? ` · ${s.updatedBy}` : ''
  return when ? `Updated ${when}${who}` : `Stored${who}`
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied')
  } catch {
    toast.error('Copy failed', 'Select and copy it manually.')
  }
}

async function start(p: CredentialProvider): Promise<void> {
  code.value[p] = ''
  try {
    await store.start(p)
  } catch {
    toast.error('Could not start sign-in', store.states[p].error ?? undefined)
  }
}

async function submit(p: CredentialProvider): Promise<void> {
  await store.submitRedirect(p, code.value[p].trim())
}

const anyBusy = computed(() => store.states.claude.busy || store.states.codex.busy)

onMounted(() => store.fetchStored())
onUnmounted(() => store.dispose())
</script>

<template>
  <div>
    <header class="mb-5 flex items-baseline justify-between gap-3">
      <p class="max-w-2xl text-sm text-[var(--color-text-muted)]">
        Re-authenticate the CLIs the agent runners share. Sign-in runs server-side and the renewed
        credentials are written to Vault, so one sign-in refreshes every runner. Claude and Codex are
        independent — start either, or both at once.
      </p>
      <button
        type="button"
        class="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] ring-1 ring-[var(--color-surface-border)] hover:text-[var(--color-text)] disabled:opacity-50"
        :disabled="anyBusy"
        data-testid="credentials-refresh"
        @click="store.fetchStored()"
      >
        Refresh status
      </button>
    </header>

    <div class="grid gap-5 lg:grid-cols-2">
      <Card v-for="p in providers" :key="p.id" :data-testid="`credentials-card-${p.id}`">
        <div class="flex flex-col gap-4 p-5">
          <!-- Header: identity + the at-a-glance connection check -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <span
                class="grid size-9 place-items-center rounded-lg text-sm font-semibold uppercase ring-1"
                :class="p.badge"
                aria-hidden="true"
              >{{ p.label.slice(0, 1) }}</span>
              <div>
                <h3 class="text-base font-semibold leading-tight">{{ p.label }}</h3>
                <p class="text-xs text-[var(--color-text-muted)]">{{ p.blurb }}</p>
              </div>
            </div>
            <span
              class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              :class="connected(p.id)
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'"
              :data-testid="`credentials-pill-${p.id}`"
            >
              <span class="size-1.5 rounded-full" :class="connected(p.id) ? 'bg-emerald-400' : 'bg-[var(--color-text-muted)]'" />
              {{ connected(p.id) ? 'Connected' : 'Not connected' }}
            </span>
          </div>

          <p class="text-xs text-[var(--color-text-muted)]" :data-testid="`credentials-check-${p.id}`">
            {{ checkLine(p.id) }}
          </p>

          <div class="h-px bg-[var(--color-surface-border)]" />

          <!-- Flow -->
          <template v-if="store.states[p.id].session && !isTerminalPhase(store.states[p.id].session!.phase)">
            <!-- In-progress: starting / finalizing show a quiet status; the
                 actionable phases get their own controls. -->
            <div
              v-if="store.states[p.id].session!.phase === 'starting' || store.states[p.id].session!.phase === 'finalizing'"
              class="flex items-center gap-2 text-sm text-[var(--color-text-muted)]"
              :data-testid="`credentials-phase-${p.id}`"
            >
              <span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {{ phaseLabel[store.states[p.id].session!.phase] }}
            </div>

            <!-- Claude: open the sign-in page, then paste the code back -->
            <template v-if="store.states[p.id].session!.phase === 'awaiting_url'">
              <ol class="space-y-3 text-sm">
                <li class="flex flex-col gap-2">
                  <span><span class="font-medium">1.</span> Open the sign-in page and approve access.</span>
                  <a
                    v-if="store.states[p.id].session!.authorizeUrl"
                    :href="store.states[p.id].session!.authorizeUrl!"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white"
                    :class="p.accent"
                    :data-testid="`credentials-open-${p.id}`"
                  >
                    Open {{ p.label }} sign-in
                    <span aria-hidden="true">↗</span>
                  </a>
                </li>
                <li class="flex flex-col gap-2">
                  <label :for="`code-${p.id}`"><span class="font-medium">2.</span> Paste the authorization code shown after you approve.</label>
                  <div class="flex items-center gap-2">
                    <input
                      :id="`code-${p.id}`"
                      v-model="code[p.id]"
                      type="text"
                      placeholder="Authorization code"
                      class="flex-1 rounded-md border border-[var(--color-surface-border)] bg-transparent px-2.5 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                      :data-testid="`credentials-code-input-${p.id}`"
                      @keyup.enter="submit(p.id)"
                    >
                    <button
                      type="button"
                      class="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-light)] disabled:opacity-50"
                      :disabled="store.states[p.id].busy || code[p.id].trim().length === 0"
                      :data-testid="`credentials-submit-${p.id}`"
                      @click="submit(p.id)"
                    >
                      Submit
                    </button>
                  </div>
                </li>
              </ol>
            </template>

            <!-- Codex: show the device code, open the device page -->
            <template v-if="store.states[p.id].session!.phase === 'awaiting_device'">
              <div class="space-y-3 text-sm">
                <p>Enter this code on the device page, then approve:</p>
                <div class="flex items-center gap-2">
                  <button
                    v-if="store.states[p.id].session!.deviceCode"
                    type="button"
                    class="rounded-md bg-[var(--color-surface-muted)] px-3 py-1.5 font-mono text-base tracking-widest"
                    :data-testid="`credentials-device-code-${p.id}`"
                    @click="copy(store.states[p.id].session!.deviceCode!)"
                  >
                    {{ store.states[p.id].session!.deviceCode }}
                  </button>
                  <a
                    v-if="store.states[p.id].session!.verificationUrl"
                    :href="store.states[p.id].session!.verificationUrl!"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white"
                    :class="p.accent"
                    :data-testid="`credentials-open-${p.id}`"
                  >
                    Open device page
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </template>

            <button
              type="button"
              class="w-fit text-xs text-[var(--color-text-muted)] underline-offset-2 hover:underline"
              :data-testid="`credentials-cancel-${p.id}`"
              @click="store.cancel(p.id)"
            >
              Cancel
            </button>
          </template>

          <!-- Terminal + idle -->
          <template v-else>
            <div
              v-if="store.states[p.id].session && store.states[p.id].session!.phase === 'succeeded'"
              class="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
              :data-testid="`credentials-success-${p.id}`"
            >
              <span aria-hidden="true">✓</span> Signed in — credentials saved to Vault.
            </div>

            <p
              v-else-if="store.states[p.id].error || (store.states[p.id].session && store.states[p.id].session!.phase === 'failed')"
              class="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300"
              :data-testid="`credentials-error-${p.id}`"
            >
              {{ store.states[p.id].error ?? store.states[p.id].session!.error ?? 'Sign-in failed.' }}
            </p>

            <button
              type="button"
              class="w-fit rounded-md px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50"
              :class="p.accent"
              :disabled="store.states[p.id].busy"
              :data-testid="`credentials-start-${p.id}`"
              @click="start(p.id)"
            >
              {{ store.states[p.id].session ? `Sign in again` : p.action }}
            </button>
          </template>
        </div>
      </Card>
    </div>
  </div>
</template>
