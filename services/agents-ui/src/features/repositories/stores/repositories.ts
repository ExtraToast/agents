import type {
  CreateRepositoryInput,
  InstallationStatus,
  Repository,
  RepositoryDetail,
  RepositoryVerifyResult,
} from '../types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createRepository as createApi,
  deleteRepository as deleteApi,
  getRepository as getApi,
  fetchInstallationStatus as installationStatusApi,
  listRepositories as listApi,
  verifyRepositoryAccess as verifyApi,
} from '../services/repositoriesService'

export const useRepositoriesStore = defineStore('repositories', () => {
  const items = ref<Repository[]>([])
  const detailById = ref<Record<string, RepositoryDetail>>({})
  const installationStatusById = ref<Record<string, InstallationStatus>>({})
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const byId = computed(() => Object.fromEntries(items.value.map((r) => [r.id, r] as const)))

  async function loadAll(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      items.value = await listApi()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loadDetail(id: string): Promise<RepositoryDetail> {
    const detail = await getApi(id)
    detailById.value[id] = detail
    // Keep the list in sync if the repository row drifted.
    const idx = items.value.findIndex((r) => r.id === id)
    if (idx >= 0) items.value[idx] = detail.repository
    return detail
  }

  async function create(input: CreateRepositoryInput): Promise<Repository> {
    const created = await createApi(input)
    items.value = [created, ...items.value]
    return created
  }

  // Live GitHub App install-status. `recheck` simply re-calls the same
  // endpoint, which queries GitHub fresh — no token is ever minted.
  async function loadInstallationStatus(id: string): Promise<InstallationStatus> {
    const status = await installationStatusApi(id)
    installationStatusById.value[id] = status
    return status
  }

  async function verify(id: string): Promise<RepositoryVerifyResult> {
    const result = await verifyApi(id)
    const detail = detailById.value[id]
    if (detail) detailById.value[id] = { ...detail, verify: result }
    return result
  }

  async function destroy(id: string): Promise<void> {
    await deleteApi(id)
    items.value = items.value.filter((r) => r.id !== id)
    delete detailById.value[id]
    delete installationStatusById.value[id]
  }

  return {
    items,
    detailById,
    installationStatusById,
    isLoading,
    error,
    byId,
    loadAll,
    loadDetail,
    create,
    loadInstallationStatus,
    verify,
    destroy,
  }
})
