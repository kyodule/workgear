import type { GitProvider } from './git-provider.js'
import { GitHubProvider } from './github-provider.js'
import { GitLabProvider } from './gitlab-provider.js'
import { GenericGitProvider } from './generic-git-provider.js'

export type GitProviderType = 'github' | 'gitlab' | 'generic'

export interface GitProviderConfig {
  providerType: string
  accessToken?: string | null
  baseUrl?: string | null
  username?: string | null
  password?: string | null
}

/**
 * Create a GitProvider instance based on provider type and credentials.
 */
export function createGitProvider(config: GitProviderConfig): GitProvider {
  const { providerType, accessToken, baseUrl, username, password } = config

  switch (providerType.toLowerCase()) {
    case 'github':
      return new GitHubProvider(accessToken || '')

    case 'gitlab':
      return new GitLabProvider(accessToken || '', baseUrl || 'https://gitlab.com')

    case 'generic':
      return new GenericGitProvider(username || '', password || '')

    default:
      throw new Error(`Unsupported Git provider type: ${providerType}`)
  }
}

/**
 * Auto-detect provider type from a Git repository URL.
 * Returns detected type, or 'github' as default.
 */
export function detectProviderType(repoUrl: string): GitProviderType {
  if (!repoUrl) return 'github'
  const lower = repoUrl.toLowerCase()
  if (lower.includes('github.com')) return 'github'
  if (lower.includes('gitlab.com') || lower.includes('gitlab')) return 'gitlab'
  return 'generic'
}
