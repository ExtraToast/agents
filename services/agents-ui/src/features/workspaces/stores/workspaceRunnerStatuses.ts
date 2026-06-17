import type { WorkspaceRunnerStatusStream } from '../services/workspaceRunnerStatusStream'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { openWorkspaceRunnerStatusStream } from '../services/workspaceRunnerStatusStream'
import { useWorkspacesStore } from './workspaces'

export type RunnerConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error'

export const useWorkspaceRunnerStatusesStore = defineStore('workspaceRunnerStatuses', () => {
  const workspaces = useWorkspacesStore()

  const connectionState = ref<RunnerConnectionState>('idle')
  const connectionError = ref<string | null>(null)
  const lastKeepaliveAt = ref<string | null>(null)
  const currentWorkspaceId = ref<string | null>(null)
  let stream: WorkspaceRunnerStatusStream | null = null
  let pendingRefresh: Promise<void> | null = null

  async function refreshSnapshot(): Promise<void> {
    const id = currentWorkspaceId.value
    if (!id) return
    await workspaces.open(id, { connectRunner: false })
  }

  function refreshOnConnect(): void {
    pendingRefresh = refreshSnapshot().catch(() => {
      connectionError.value = 'Failed to refresh workspace runner status'
    })
  }

  function connect(workspaceId: string): void {
    // Prevent duplicate active streams for the same workspace.
    if (stream && currentWorkspaceId.value === workspaceId) return
    disconnect()
    currentWorkspaceId.value = workspaceId
    connectionState.value = 'connecting'
    connectionError.value = null
    stream = openWorkspaceRunnerStatusStream(workspaceId, {
      onOpen() {
        connectionState.value = 'open'
        connectionError.value = null
        refreshOnConnect()
      },
      onReconnecting() {
        connectionState.value = 'reconnecting'
        connectionError.value = null
      },
      onError() {
        connectionState.value = 'error'
        connectionError.value = 'Runner status stream disconnected'
      },
      onRunnerReadiness(event) {
        if (event.workspaceId === currentWorkspaceId.value) {
          workspaces.runnerReadiness = event.readiness
        }
      },
      onKeepalive(event) {
        lastKeepaliveAt.value = event.ts ?? new Date().toISOString()
      },
      onMalformed() {
        // malformed events are silently ignored for runner stream
      },
    })
  }

  function disconnect(): void {
    stream?.close()
    stream = null
    pendingRefresh = null
    connectionState.value = 'idle'
    connectionError.value = null
    currentWorkspaceId.value = null
  }

  async function waitForRefresh(): Promise<void> {
    await (pendingRefresh ?? Promise.resolve())
  }

  return {
    connectionState,
    connectionError,
    lastKeepaliveAt,
    currentWorkspaceId,
    connect,
    disconnect,
    waitForRefresh,
  }
})
