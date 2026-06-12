import { expect, test } from '@playwright/test'
import { installAuthenticatedAppMocks } from './mocks'

test('workspace agent console opens with status stream and terminal socket mocks', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')

  await expect(page.getByTestId('workspace-console')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Demo workspace' })).toBeVisible()
  await expect(page.getByTestId('workspace-status-summary')).toContainText('Status live')
  await expect(page.getByTestId('session-status-rail-connection')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('workspace-active-session-label')).toContainText('sess-1')
  await expect(page.getByTestId('session-terminal')).toBeVisible()
})

test('workspace agent console starts agents and stages text for the active session', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions/workspace/ws-1')
  await page.getByRole('button', { name: 'Codex' }).click()
  await page.getByTestId('workspace-new-agent').click()

  await expect(page.getByTestId('session-tab-sess-2')).toBeVisible()
  await expect(page.getByTestId('workspace-active-session-label')).toContainText('sess-2')

  await page.getByTestId('stage-input-open').click()
  await page.getByTestId('stage-input-content').fill('Use this e2e staged text.')
  await page.getByTestId('stage-input-submit').click()

  await expect(page.getByTestId('stage-input-form')).toBeHidden()
})
