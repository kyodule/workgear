import type { GitProvider, CreatePullRequestParams, PullRequestResult, MergePullRequestParams, MergePullRequestResult } from './git-provider.js'

/**
 * GenericGitProvider for plain Git repositories (HTTPS with username/password).
 * Does NOT support pull request operations (no standard Git PR API).
 */
export class GenericGitProvider implements GitProvider {
  readonly supportsPullRequests = false

  constructor(
    private username: string,
    private password: string
  ) {}

  async createPullRequest(_params: CreatePullRequestParams): Promise<PullRequestResult> {
    throw new Error('Generic Git provider does not support pull request operations')
  }

  async mergePullRequest(_params: MergePullRequestParams): Promise<MergePullRequestResult> {
    throw new Error('Generic Git provider does not support pull request operations')
  }

  parseRepoUrl(_url: string): { owner: string; repo: string } | null {
    // Generic Git URLs don't have a standard owner/repo structure
    // Return null to indicate parsing is not applicable
    return null
  }

  /**
   * Get credentials for Git HTTPS authentication.
   * Used by Go orchestrator to inject into Git URL.
   */
  getCredentials(): { username: string; password: string } {
    return {
      username: this.username,
      password: this.password,
    }
  }
}
