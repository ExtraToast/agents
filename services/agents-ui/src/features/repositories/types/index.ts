// Types for the repositories feature.
//
// Wire shapes (Repository, CreateRepositoryInput, InstallationStatus)
// flow through the OpenAPI contract pinned at
// `services/agents-api/openapi.json` and the regenerated
// `src/api/generated.ts`. Drift against the agents-api DTOs is
// detected by `pnpm contract:check` in CI — see
// `services/agents-api/CONTRACT.md`.
//
// `RepositoryDetail` + `AttachedProject` stay hand-rolled until the
// backend's `GET /repositories/{id}` returns a typed response body
// (today it serialises as `Map<String, Any>`, which springdoc emits
// as `object` without a schema).

import type { components } from '@/api/generated'

export type Repository = components['schemas']['RepositoryResponse']
export type CreateRepositoryInput = components['schemas']['CreateRepositoryRequest']

// Live GitHub App installation status for a repository, returned by
// `GET /repositories/{id}/installation-status`. `state` is one of
// INSTALLED / NOT_INSTALLED / UNKNOWN.
export type InstallationStatus = components['schemas']['RepositoryInstallationStatusResponse']

// Branch-protection verification result for a repository's default
// branch, surfaced via `GET /repositories/{id}` and refreshed by
// `POST /repositories/{id}/verify`. Deploy-key read/write access is no
// longer probed — GitHub App install-status is the access signal.
export interface RepositoryVerifyResult {
  // null = no GitHub token configured or the protection check was
  // inconclusive (never a hard failure).
  defaultBranchProtected: boolean | null
  checkedAt: string
  messages: string[]
}

export interface RepositoryDetail {
  repository: Repository
  attachedProjects: AttachedProject[]
  // Present once the backend has run (or cached) a verification pass.
  // Absent on repositories that have never been verified.
  verify?: RepositoryVerifyResult | null
}

export interface AttachedProject {
  id: string
  name: string
  slug: string
}
