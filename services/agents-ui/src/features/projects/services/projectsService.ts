import type { GithubLink, Project, ProjectDetail } from '../types'
import type { Repository } from '@/features/repositories'
import { useApiWithAuth } from '@/lib/vueWebCommons'

function getApi(): ReturnType<typeof useApiWithAuth> {
  return useApiWithAuth()
}

export async function listProjects(): Promise<Project[]> {
  return getApi().get<Project[]>('/projects')
}

export async function getProject(id: string): Promise<ProjectDetail> {
  return getApi().get<ProjectDetail>(`/projects/${id}`)
}

export async function createProject(input: { name: string; slug: string; description?: string }): Promise<Project> {
  return getApi().post<Project>('/projects', input)
}

export async function addLink(
  projectId: string,
  input: {
    name: string
    repoUrl: string
    defaultBranch?: string
  },
): Promise<GithubLink> {
  return getApi().post<GithubLink>(`/projects/${projectId}/links`, input)
}

export async function removeLink(projectId: string, linkId: string): Promise<void> {
  return getApi().del(`/projects/${projectId}/links/${linkId}`)
}

/**
 * Link an existing Repository to a Project. The Project's repository
 * pool is the source of truth for which repos the operator can pick
 * when opening a workspace under that project.
 */
export async function linkRepository(projectId: string, repositoryId: string): Promise<Repository[]> {
  return getApi().post<Repository[]>(`/projects/${projectId}/repositories`, { repositoryId })
}

export async function unlinkRepository(projectId: string, repositoryId: string): Promise<void> {
  await getApi().del(`/projects/${projectId}/repositories/${repositoryId}`)
}
