<script setup lang="ts">
import type { CredentialProvider } from '../types'
import { onUnmounted, ref } from 'vue'
import { Card, useToast } from '@/lib/vueWebCommons'
import { useCredentialsStore } from '../stores/credentials'
import { isTerminalPhase } from '../types'

const store = useCredentialsStore()
const toast = useToast()

const providers: { id: CredentialProvider; label: string; blurb: string }[] = [
  { id: 'claude', label: 'Claude Code', blurb: 'claude /login — paste the redirect URL back after approving.' },
  { id: 'codex', label: 'Codex', blurb: 'codex login --device — enter the code on the OpenAI device page.' },
]

const redirectUrl = ref<Record<CredentialProvider, string>>({ claude: '', codex: '' })

const phaseLabels: Record<string, string> = {
  starting: 'Starting the CLI…',
  awaiting_url: 'Waiting for you to approve and paste the redirect URL',
  awaiting_device: 'Waiting for you to enter the code and approve',
  finalizing: 'Capturing credentials and writing to Vault…',
  succeeded: 'Credentials renewed',
  failed: 'Login failed',
  cancelled: 'Cancelled',
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Copy failed', 'Select and copy the text manually.')
  }
}

async function start(provider: CredentialProvider): Promise<void> {
  redirectUrl.value[provider] = ''
  try {
    await store.start(provider)
  } catch {
    toast.error('Could not start login', store.states[provider].error ?? undefined)
  }
}

async function submit(provider: CredentialProvider): Promise<void> {
  await store.submitRedirect(provider, redirectUrl.value[provider].trim())
}

onUnmounted(() => store.dispose())
</script>

<template>
  <div>
    <p class="mb-4 text-sm text-[var(--color-text-muted)]">
      Re-authenticate the Claude Code and Codex CLIs the agent runners share. The login runs server-side and the
      renewed credentials are written to Vault, so one sign-in refreshes every runner — no terminal needed.
    </p>

    <div class="grid gap-6 md:grid-cols-2">
      <Card v-for="p in providers" :key="p.id" :data-testid="`credentials-card-${p.id}`">
        <div class="p-5">
          <h3 class="text-lg font-semibold">{{ p.label }}</h3>
          <p class="mt-1 text-sm text-[var(--color-text-muted)]">{{ p.blurb }}</p>

          <p
            v-if="store.states[p.id].error"
            class="mt-3 text-sm text-red-400"
            :data-testid="`credentials-error-${p.id}`"
          >
            {{ store.states[p.id].error }}
          </p>

          <template v-if="store.states[p.id].session">
            <p class="mt-4 text-sm font-medium" :data-testid="`credentials-phase-${p.id}`">
              {{ phaseLabels[store.states[p.id].session!.phase] ?? store.states[p.id].session!.phase }}
            </p>

            <div v-if="store.states[p.id].session!.authorizeUrl" class="mt-3">
              <label class="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Authorize URL</label>
              <div class="mt-1 flex items-center gap-2">
                <code
                  class="flex-1 truncate rounded bg-[var(--color-surface-muted)] px-2 py-1 text-xs"
                  :data-testid="`credentials-authorize-url-${p.id}`"
                >{{ store.states[p.id].session!.authorizeUrl }}</code>
                <button
                  type="button"
                  class="rounded border border-[var(--color-surface-border)] px-2 py-1 text-xs"
                  @click="copy(store.states[p.id].session!.authorizeUrl!)"
                >
                  Copy
                </button>
              </div>
            </div>

            <div v-if="store.states[p.id].session!.needsRedirectUrl" class="mt-3">
              <label class="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Redirect URL</label>
              <div class="mt-1 flex items-center gap-2">
                <input
                  v-model="redirectUrl[p.id]"
                  type="text"
                  placeholder="https://claude.ai/oauth/callback?code=…"
                  class="flex-1 rounded border border-[var(--color-surface-border)] bg-transparent px-2 py-1 text-sm"
                  :data-testid="`credentials-redirect-input-${p.id}`"
                  @keyup.enter="submit(p.id)"
                >
                <button
                  type="button"
                  class="rounded bg-[var(--color-accent)] px-3 py-1 text-sm font-medium text-white hover:bg-[var(--color-accent-light)] disabled:opacity-50"
                  :disabled="store.states[p.id].busy || redirectUrl[p.id].trim().length === 0"
                  :data-testid="`credentials-redirect-submit-${p.id}`"
                  @click="submit(p.id)"
                >
                  Submit
                </button>
              </div>
            </div>

            <div v-if="store.states[p.id].session!.deviceCode" class="mt-3 text-sm">
              <span class="text-[var(--color-text-muted)]">Code </span>
              <button
                type="button"
                class="rounded bg-[var(--color-surface-muted)] px-2 py-1 font-mono"
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
                class="ml-2 text-[var(--color-accent-light)] underline"
              >Open device page</a>
            </div>

            <div class="mt-4 flex gap-2">
              <button
                v-if="!isTerminalPhase(store.states[p.id].session!.phase)"
                type="button"
                class="rounded border border-[var(--color-surface-border)] px-3 py-1 text-sm"
                :data-testid="`credentials-cancel-${p.id}`"
                @click="store.cancel(p.id)"
              >
                Cancel
              </button>
              <button
                v-else
                type="button"
                class="rounded border border-[var(--color-surface-border)] px-3 py-1 text-sm"
                :data-testid="`credentials-reset-${p.id}`"
                @click="store.reset(p.id)"
              >
                Start over
              </button>
            </div>
          </template>

          <button
            v-else
            type="button"
            class="mt-4 rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-light)] disabled:opacity-50"
            :disabled="store.states[p.id].busy"
            :data-testid="`credentials-start-${p.id}`"
            @click="start(p.id)"
          >
            Start login
          </button>
        </div>
      </Card>
    </div>
  </div>
</template>
