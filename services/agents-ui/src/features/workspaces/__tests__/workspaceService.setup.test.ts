import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/vueWebCommons'
import {
  agentSetupValidationProblemFromError,
  getSessionSetup,
  listSessionSetupTransitions,
  listSetupOptions,
  listWorkspaceSetupTransitions,
  previewSetup,
  restartSession,
} from '../services/workspaceService'

const get = vi.fn()
const post = vi.fn()

vi.mock('@/lib/vueWebCommons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vueWebCommons')>()
  return { ...actual, useApiWithAuth: () => ({ post, get, del: vi.fn() }) }
})

function validationProblem() {
  return {
    type: 'https://jorisjonkers.dev/errors/agent-setup-validation',
    title: 'Agent setup validation failed',
    status: 422,
    detail: 'Agent setup target is not valid for this workspace or session.',
    errors: [{ field: 'TARGET_NOT_SELECTABLE', message: 'TARGET_NOT_SELECTABLE', rejectedValue: null }],
  }
}

describe('workspaceService setup adapters', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('loads setup state, options, and transition history from setup REST routes', async () => {
    get
      .mockResolvedValueOnce({ current: { id: 'setup-current', version: 1 }, pending: null, failed: null })
      .mockResolvedValueOnce({ current: { id: 'setup-current', version: 1 }, pending: null, options: [] })
      .mockResolvedValueOnce({ events: [] })
      .mockResolvedValueOnce({ events: [] })

    await getSessionSetup('ws-1', 'sess-1')
    await listSetupOptions('ws-1', 'sess-1')
    await listWorkspaceSetupTransitions('ws-1')
    await listSessionSetupTransitions('ws-1', 'sess-1')

    expect(get).toHaveBeenNthCalledWith(1, '/workspaces/ws-1/sessions/sess-1/setup')
    expect(get).toHaveBeenNthCalledWith(2, '/workspaces/ws-1/sessions/sess-1/setup-options')
    expect(get).toHaveBeenNthCalledWith(3, '/workspaces/ws-1/setup-transitions')
    expect(get).toHaveBeenNthCalledWith(4, '/workspaces/ws-1/sessions/sess-1/setup-transitions')
  })

  it('loads setup preview with encoded target setup query parameters', async () => {
    get.mockResolvedValueOnce({
      current: { id: 'setup/current', version: 1 },
      target: { id: 'setup/next', version: 2 },
      diff: null,
      validation: { target: { id: 'setup/next', version: 2 }, valid: true, issues: [], warnings: [] },
    })

    await previewSetup('ws-1', 'sess-1', { id: 'setup/next', version: 2 })

    expect(get).toHaveBeenCalledWith(
      '/workspaces/ws-1/sessions/sess-1/setup-preview?targetSetupId=setup%2Fnext&targetSetupVersion=2',
    )
  })

  it('posts setup-aware restart request bodies without undefined fields', async () => {
    post.mockResolvedValueOnce({
      sessionId: 'sess-1',
      epoch: 2,
      generation: 4,
      status: 'RUNNING',
      currentSetup: { id: 'setup-next', version: 2 },
      pendingSetup: null,
    })

    await restartSession('ws-1', 'sess-1', {
      expectedGeneration: 3,
      expectedEpoch: 1,
      expectedSetupId: 'setup-current',
      expectedSetupVersion: 1,
      expectedCurrentSetupId: 'setup-current',
      expectedCurrentSetupVersion: 1,
      targetSetupId: 'setup-next',
      targetSetupVersion: 2,
    })

    expect(post).toHaveBeenCalledWith('/workspaces/ws-1/sessions/sess-1/restart', {
      expectedGeneration: 3,
      expectedEpoch: 1,
      expectedSetupId: 'setup-current',
      expectedSetupVersion: 1,
      expectedCurrentSetupId: 'setup-current',
      expectedCurrentSetupVersion: 1,
      targetSetupId: 'setup-next',
      targetSetupVersion: 2,
    })
  })

  it('keeps the legacy expected-generation restart adapter shape', async () => {
    post.mockResolvedValueOnce({ sessionId: 'sess-1', epoch: 2, generation: 4, status: 'RUNNING' })

    await restartSession('ws-1', 'sess-1', 3)

    expect(post).toHaveBeenCalledWith('/workspaces/ws-1/sessions/sess-1/restart', { expectedGeneration: 3 })
  })

  it('extracts setup validation problem bodies from ApiError', () => {
    const problem = validationProblem()

    expect(agentSetupValidationProblemFromError(new ApiError(problem))).toEqual(problem)
    expect(
      agentSetupValidationProblemFromError(
        new ApiError({ type: 'about:blank', title: 'Other validation', status: 422, errors: [] }),
      ),
    ).toBeNull()
  })
})
