import type { InstallationStatus, Repository, RepositoryDetail, RepositoryVerifyResult } from '../types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import RepositoryView from '../views/RepositoryView.vue'

const getRepository = vi.fn<(id: string) => Promise<RepositoryDetail>>()
const fetchInstallationStatus = vi.fn<(id: string) => Promise<InstallationStatus>>()
const verifyRepositoryAccess = vi.fn<(id: string) => Promise<RepositoryVerifyResult>>()

vi.mock('../services/repositoriesService', () => ({
  listRepositories: vi.fn(),
  getRepository: (id: string) => getRepository(id),
  createRepository: vi.fn(),
  deleteRepository: vi.fn(),
  fetchInstallationStatus: (id: string) => fetchInstallationStatus(id),
  verifyRepositoryAccess: (id: string) => verifyRepositoryAccess(id),
}))

function fakeRepo(over: Partial<Repository> = {}): Repository {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'demo',
    repoUrl: 'git@github.com:owner/demo.git',
    defaultBranch: 'main',
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
    ...over,
  }
}

function detail(over: Partial<RepositoryDetail> = {}): RepositoryDetail {
  return { repository: fakeRepo(), attachedProjects: [], ...over }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/repositories', component: { template: '<div />' } },
    { path: '/repositories/:id', component: RepositoryView },
    { path: '/projects/:id', component: { template: '<div />' } },
  ],
})

async function mountView() {
  await router.push('/repositories/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  await router.isReady()
  const wrapper = mount(RepositoryView, { global: { plugins: [router] } })
  await flush()
  return wrapper
}

describe('repositoryView access status', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getRepository.mockReset()
    fetchInstallationStatus.mockReset()
    verifyRepositoryAccess.mockReset()
    fetchInstallationStatus.mockResolvedValue({
      state: 'UNKNOWN',
      checkedAt: '2026-05-21T10:00:00Z',
      detail: null,
    })
  })

  it('shows install status even before branch protection has been verified', async () => {
    fetchInstallationStatus.mockResolvedValue({
      state: 'INSTALLED',
      checkedAt: '2026-05-21T10:00:00Z',
      detail: null,
    })
    getRepository.mockResolvedValue(detail())
    const wrapper = await mountView()
    expect(fetchInstallationStatus).toHaveBeenCalledWith('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    expect(wrapper.find('[data-testid="github-app-install-status"]').text()).toBe(
      'App installed - can access this repo',
    )
    expect(wrapper.find('[data-testid="access-app-installation"]').attributes('data-tone')).toBe('ok')
    expect(wrapper.find('[data-testid="access-protection"]').exists()).toBe(false)
  })

  it('renders app/protection badges with the right tones once verified', async () => {
    fetchInstallationStatus.mockResolvedValue({
      state: 'NOT_INSTALLED',
      checkedAt: '2026-05-21T10:00:00Z',
      detail: 'no matching installation',
    })
    getRepository.mockResolvedValue(
      detail({
        verify: {
          defaultBranchProtected: false,
          checkedAt: '2026-05-21T10:00:00Z',
          messages: ['branch protection disabled'],
        },
      }),
    )
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="access-app-installation"]').attributes('data-tone')).toBe('fail')
    expect(wrapper.find('[data-testid="access-app-installation"]').text()).toContain('App not installed')
    expect(wrapper.find('[data-testid="access-protection"]').attributes('data-tone')).toBe('warn')
    expect(wrapper.find('[data-testid="repository-protection-warning"]').exists()).toBe(true)
  })

  it('renders protection as unknown when the token is absent (null)', async () => {
    getRepository.mockResolvedValue(
      detail({
        verify: {
          defaultBranchProtected: null,
          checkedAt: '2026-05-21T10:00:00Z',
          messages: [],
        },
      }),
    )
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="access-protection"]').attributes('data-tone')).toBe('unknown')
    expect(wrapper.find('[data-testid="repository-protection-unknown"]').exists()).toBe(true)
  })

  it('renders GitHub App owner guidance and canonical external links', async () => {
    getRepository.mockResolvedValue(detail({ repository: fakeRepo({ repoUrl: 'git@github.com:ExtraToast/demo.git' }) }))
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="github-app-owner"]').text()).toBe('ExtraToast')
    expect(wrapper.find('[data-testid="github-app-permissions"]').text()).toMatch(/Contents:\s+write/)
    expect(wrapper.find('[data-testid="github-app-permissions"]').text()).toMatch(/Pull requests:\s+write/)
    expect(wrapper.find('[data-testid="github-app-permissions"]').text()).toMatch(/Actions:\s+write/)
    expect(wrapper.find('[data-testid="github-app-permissions"]').text()).toMatch(/Issues:\s+write/)
    expect(wrapper.find('[data-testid="github-app-permissions"]').text()).toMatch(/Workflows:\s+write/)
    expect(wrapper.find('[data-testid="github-app-permissions"]').text()).toMatch(/Packages:\s+read/)
    expect(wrapper.find('[data-testid="github-app-approval-note"]').text()).toContain('approval on each installation')

    const expectedLinks = {
      'github-app-install-link': 'https://github.com/apps/jorisjonkers-dev-agents/installations/new?state=ExtraToast',
      'github-app-user-installations-link': 'https://github.com/settings/installations',
      'github-app-organization-installations-link':
        'https://github.com/organizations/ExtraToast/settings/installations',
      'github-app-permissions-link': 'https://github.com/settings/apps/jorisjonkers-dev-agents/permissions',
    }

    for (const [testId, href] of Object.entries(expectedLinks)) {
      const link = wrapper.find(`[data-testid="${testId}"]`)
      expect(link.attributes('href')).toBe(href)
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    }
  })

  it('renders a clear message when the repo owner cannot be parsed', async () => {
    getRepository.mockResolvedValue(detail({ repository: fakeRepo({ repoUrl: 'not-a-github-url' }) }))
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="github-app-owner-missing"]').text()).toContain('could not parse')
    expect(wrapper.find('[data-testid="github-app-owner-parse-warning"]').text()).toContain(
      'installation link cannot be built',
    )
    expect(wrapper.find('[data-testid="github-app-install-link"]').exists()).toBe(false)
  })

  it('re-check button refreshes GitHub App installation status', async () => {
    getRepository.mockResolvedValue(detail())
    fetchInstallationStatus
      .mockResolvedValueOnce({ state: 'UNKNOWN', checkedAt: '2026-05-21T10:00:00Z', detail: null })
      .mockResolvedValueOnce({ state: 'INSTALLED', checkedAt: '2026-05-21T10:01:00Z', detail: null })
    const wrapper = await mountView()

    await wrapper.find('[data-testid="github-app-recheck"]').trigger('click')
    await flush()

    expect(fetchInstallationStatus).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="github-app-install-status"]').text()).toBe(
      'App installed - can access this repo',
    )
  })

  it('verify-access button calls the verify endpoint and stores the result', async () => {
    getRepository.mockResolvedValue(detail())
    verifyRepositoryAccess.mockResolvedValue({
      defaultBranchProtected: true,
      checkedAt: '2026-05-21T10:00:00Z',
      messages: [],
    })
    const wrapper = await mountView()

    await wrapper.find('[data-testid="repository-verify"]').trigger('click')
    await flush()

    expect(verifyRepositoryAccess).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="access-protection"]').text()).toContain('Branch protected')
  })
})

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve()
    await nextTick()
  }
}
