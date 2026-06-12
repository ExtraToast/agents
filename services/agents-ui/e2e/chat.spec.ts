import { expect, test } from '@playwright/test'
import { installAuthenticatedAppMocks } from './mocks'

test('root redirects authenticated users to sessions', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/')

  await page.waitForURL('**/sessions')
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible()
  await expect(page.getByTestId('workspace-tab')).toBeVisible()
})

test('sessions route redirects unauthenticated users to login', async ({ page }) => {
  await installAuthenticatedAppMocks(page, { authenticated: false })

  await page.goto('/sessions')

  await page.waitForURL(/\/login\?redirect=/)
})

test('chat sessions can open and stream an answer from the sessions view', async ({ page }) => {
  await installAuthenticatedAppMocks(page)

  await page.goto('/sessions?tab=chat')

  await expect(page.getByTestId('chat-tab')).toBeVisible()
  await expect(page.getByTestId('chat-session-chat-1')).toContainText('Planning brief')
  await expect(page.getByTestId('chat-detail-chat-1')).toBeVisible()
  await expect(page.getByText('Use the sessions workspace.')).toBeVisible()

  await page.getByTestId('chat-input').fill('Summarize the workspace')
  await page.getByTestId('chat-send-submit').click()

  await expect(page.getByText('Summarize the workspace')).toBeVisible()
  await expect(page.getByText('Mock streamed answer')).toBeVisible()
})
