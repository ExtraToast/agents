import { expect, test } from '@playwright/test'
import { installAuthenticatedAppMocks } from './mocks'

test('workspace agent console opens with status stream and terminal socket mocks', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')

  await expect(page.getByTestId('workspace-console')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Demo workspace' })).toBeVisible()
  await expect(page.getByTestId('workspace-status-summary')).toContainText('Live')
  await expect(page.getByTestId('session-status-rail-connection')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('session-status-rail-label')).toContainText('sess-1')
  await expect(page.getByTestId('session-terminal')).toBeVisible()
})

test('workspace agent console starts agents and stages text for the active session', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')
  await page.getByTestId('workspace-new-session').click()
  await page.getByTestId('workspace-new-session-option-codex').click()

  await expect(page.getByTestId('session-tab-sess-2')).toBeVisible()
  await expect(page.getByTestId('session-status-rail-label')).toContainText('sess-2')

  await page.getByTestId('stage-input-open').click()
  await page.getByTestId('stage-input-content').fill('Use this e2e staged text.')
  await page.getByTestId('stage-input-submit').click()

  await expect(page.getByTestId('stage-input-form')).toBeHidden()
})

test('connect-on-open readiness: READY runner enables the spawn button', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')

  await expect(page.getByTestId('workspace-console')).toBeVisible()
  // With READY state the "+" tab button is enabled.
  await expect(page.getByTestId('workspace-new-session')).toBeEnabled()
  await expect(page.getByTestId('workspace-new-session')).not.toContainText('Runner booting')
})

test('runner in BOOTING state disables the spawn button', async ({ page }) => {
  await installAuthenticatedAppMocks(page, { runnerState: 'BOOTING' })

  await page.goto('/sessions/workspace/ws-1')

  await expect(page.getByTestId('workspace-console')).toBeVisible()
  await expect(page.getByTestId('workspace-new-session')).toBeDisabled()
})

test('workspace opens without auto-starting a session', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')

  await expect(page.getByTestId('workspace-console')).toBeVisible()
  // Only the pre-seeded sess-1 tab should exist; no session is auto-started on open.
  await expect(page.getByTestId('session-tab-sess-1')).toBeVisible()
  await expect(page.getByTestId('session-tab-sess-2')).toBeHidden()
})

test('duplicate explicit start creates only one session', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')
  await expect(page.getByTestId('workspace-console')).toBeVisible()

  // Two synchronous startSession calls via the dropdown menu; the
  // startingSessionByKey dedup map returns the existing promise to the second
  // caller, so only one session is created.
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="workspace-new-session"]')
    if (btn instanceof HTMLElement) btn.click()
  })
  await page.evaluate(() => {
    const opt = document.querySelector('[data-testid="workspace-new-session-option-claude"]')
    if (opt instanceof HTMLElement) {
      opt.click()
      opt.click()
    }
  })

  await expect(page.getByTestId('session-tab-sess-2')).toBeVisible()
  await expect(page.getByTestId('session-tab-sess-3')).toBeHidden()
})

test('native SSE reconnect: close transitions to Connecting, reopen returns to Live', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')

  await expect(page.getByTestId('workspace-status-summary')).toContainText('Live')
  await expect(page.getByTestId('session-status-rail-connection')).toHaveAttribute('data-state', 'open')

  // Simulate the EventSource dropping (readyState CLOSED → onerror fires).
  // sessionStatusStream.ts maps this to onError → connectionState = 'error'.
  await page.evaluate(() => {
    // @ts-expect-error window is augmented by installBrowserConnectionMocks
    window.__mockSseControl.closeAll()
  })

  await expect(page.getByTestId('workspace-status-summary')).not.toContainText('Live')
  await expect(page.getByTestId('session-status-rail-connection')).toHaveAttribute('data-state', 'error')

  // Simulate the browser's native auto-reconnect completing.
  await page.evaluate(() => {
    // @ts-expect-error window is augmented by installBrowserConnectionMocks
    window.__mockSseControl.reopenAll()
  })

  await expect(page.getByTestId('workspace-status-summary')).toContainText('Live')
  await expect(page.getByTestId('session-status-rail-connection')).toHaveAttribute('data-state', 'open')
})

test('post-stop refresh does not reconnect the runner', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')

  // First connect returns READY → spawn button enabled with agent kind label.
  await expect(page.getByTestId('workspace-new-session')).toBeEnabled()
  await expect(page.getByTestId('workspace-new-session')).not.toContainText('Runner booting')

  // Stop the active session. endSession calls open({ connectRunner: false }),
  // so no second connect request is issued.
  await page.getByTestId('workspace-active-stop').click()

  // Wait for the stop to propagate: the session is no longer live so the
  // empty-state panel appears (activeSessionIsLive → false).
  await expect(page.getByTestId('workspace-empty-state')).toBeVisible()

  // The spawn button should retain READY state. If a reconnect had fired, the
  // mock's second connect returns BOOTING and the label would change to
  // "Runner booting…", causing this assertion to fail.
  await expect(page.getByTestId('workspace-new-session')).not.toContainText('Runner booting')
  await expect(page.getByTestId('workspace-new-session')).not.toBeDisabled()
})

test('post-start refresh does not reconnect the runner', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')

  // First connect returns READY.
  await expect(page.getByTestId('workspace-new-session')).toBeEnabled()

  // Start a new session. Open the "+" dropdown and pick Claude.
  await page.getByTestId('workspace-new-session').click()
  await page.getByTestId('workspace-new-session-option-claude').click()
  await expect(page.getByTestId('session-tab-sess-2')).toBeVisible()

  // Spawn button should still reflect READY (not BOOTING from a second connect).
  await expect(page.getByTestId('workspace-new-session')).not.toContainText('Runner booting')
  await expect(page.getByTestId('workspace-new-session')).not.toBeDisabled()
})
