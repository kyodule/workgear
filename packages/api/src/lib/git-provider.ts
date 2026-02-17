/**
 * Git provider abstraction for creating pull requests across different platforms.
 */

export interface CreatePullRequestParams {
  owner: string
  repo: string
  title: string
  head: string // feature branch
  base: string // target branch
  body?: string
}

export interface PullRequestResult {
  url: string
  number: number
}

export interface MergePullRequestParams {
  owner: string
  repo: string
  pullNumber: number
  mergeMethod?: 'merge' | 'squash' | 'rebase'
  commitTitle?: string
}

export interface MergePullRequestResult {
  merged: boolean
  sha?: string
  message?: string
}

export interface GitProvider {
  /**
   * Whether this provider supports pull/merge request operations.
   * Generic Git providers (plain HTTPS) do not support PR APIs.
   */
  readonly supportsPullRequests: boolean

  /**
   * Create a pull request (or merge request for GitLab).
   * @throws Error if PR creation fails or not supported
   */
  createPullRequest(params: CreatePullRequestParams): Promise<PullRequestResult>

  /**
   * Merge a pull request.
   * @throws Error if merge fails or not supported
   */
  mergePullRequest(params: MergePullRequestParams): Promise<MergePullRequestResult>

  /**
   * Parse owner and repo from a Git URL.
   * @returns { owner, repo } or null if not parseable
   */
  parseRepoUrl(url: string): { owner: string; repo: string } | null

  /**
   * Delete a remote branch.
   * Optional — only supported by providers with API access.
   */
  deleteBranch?(owner: string, repo: string, branch: string): Promise<boolean>
}
