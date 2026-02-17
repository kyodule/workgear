import type { GitProvider, CreatePullRequestParams, PullRequestResult, MergePullRequestParams, MergePullRequestResult } from './git-provider.js'

export class GitLabProvider implements GitProvider {
  readonly supportsPullRequests = true

  constructor(
    private token: string,
    private baseUrl: string = 'https://gitlab.com'
  ) {}

  async createPullRequest(params: CreatePullRequestParams): Promise<PullRequestResult> {
    const { owner, repo, title, head, base, body } = params

    // GitLab uses project ID (namespace/project) URL-encoded
    const projectId = encodeURIComponent(`${owner}/${repo}`)
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_branch: head,
        target_branch: base,
        title,
        description: body || '',
      }),
    })

    if (!response.ok) {
      // 409 means MR already exists
      if (response.status === 409) {
        const error = await response.json().catch(() => ({})) as any
        if (error.message?.includes('already exists')) {
          const existingMR = await this.findExistingMR(owner, repo, head, base)
          if (existingMR) {
            return existingMR
          }
        }
      }
      const errorText = await response.text()
      throw new Error(`GitLab API error (${response.status}): ${errorText}`)
    }

    const data = await response.json() as any
    return {
      url: data.web_url,
      number: data.iid, // GitLab uses iid (internal ID) not id
    }
  }

  private async findExistingMR(
    owner: string,
    repo: string,
    head: string,
    base: string
  ): Promise<PullRequestResult | null> {
    const projectId = encodeURIComponent(`${owner}/${repo}`)
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests?source_branch=${head}&target_branch=${base}&state=opened`

    const response = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': this.token,
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      return {
        url: data[0].web_url,
        number: data[0].iid,
      }
    }

    return null
  }

  async mergePullRequest(params: MergePullRequestParams): Promise<MergePullRequestResult> {
    const { owner, repo, pullNumber, mergeMethod = 'merge', commitTitle } = params

    const projectId = encodeURIComponent(`${owner}/${repo}`)
    
    // First, check MR status to provide better error messages
    const statusUrl = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${pullNumber}`
    const statusResponse = await fetch(statusUrl, {
      headers: {
        'PRIVATE-TOKEN': this.token,
      },
    })
    
    if (statusResponse.ok) {
      const mrData = await statusResponse.json() as any
      // Check merge_status: can_be_merged, cannot_be_merged, unchecked, checking
      if (mrData.merge_status === 'cannot_be_merged') {
        return { merged: false, message: 'MR has conflicts and cannot be merged' }
      }
      if (mrData.merge_status === 'checking' || mrData.merge_status === 'unchecked') {
        return { merged: false, message: 'MR merge status is still being checked, please try again later' }
      }
      // Check if MR is already merged
      if (mrData.state === 'merged') {
        return { merged: true, sha: mrData.merge_commit_sha, message: 'Already merged' }
      }
      // Check blocking conditions
      if (mrData.blocking_discussions_resolved === false) {
        return { merged: false, message: 'MR has unresolved discussions' }
      }
      if (mrData.work_in_progress || mrData.draft) {
        return { merged: false, message: 'MR is marked as draft/WIP' }
      }
    }

    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${pullNumber}/merge`

    // GitLab merge methods: merge (default), merge_when_pipeline_succeeds, rebase_merge
    let shouldRemoveSourceBranch = true
    let squash = false
    if (mergeMethod === 'squash') {
      squash = true
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        should_remove_source_branch: shouldRemoveSourceBranch,
        squash,
        ...(commitTitle && { merge_commit_message: commitTitle }),
      }),
    })

    if (response.ok) {
      const data = await response.json() as any
      return { merged: true, sha: data.merge_commit_sha, message: data.title }
    }

    // 405/406: not mergeable, 409: conflict
    if (response.status === 405 || response.status === 406 || response.status === 409) {
      const data = await response.json().catch(() => ({})) as any
      const reason = data.message || response.statusText || `HTTP ${response.status}`
      // Provide more context for common merge blockers
      let hint = ''
      if (response.status === 405) {
        hint = ' (MR may have conflicts, require approvals, or pipeline checks)'
      } else if (response.status === 409) {
        hint = ' (merge conflict detected)'
      }
      return { merged: false, message: `${reason}${hint}` }
    }

    const errorText = await response.text()
    return { merged: false, message: `GitLab API error (${response.status}): ${errorText}` }
  }

  async deleteBranch(owner: string, repo: string, branch: string): Promise<boolean> {
    const projectId = encodeURIComponent(`${owner}/${repo}`)
    const branchEncoded = encodeURIComponent(branch)
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/repository/branches/${branchEncoded}`

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'PRIVATE-TOKEN': this.token,
      },
    })
    return response.status === 204
  }

  parseRepoUrl(url: string): { owner: string; repo: string } | null {
    // Support formats:
    // https://gitlab.com/owner/repo.git
    // https://gitlab.com/owner/repo
    // https://token@gitlab.com/owner/repo.git
    // git@gitlab.com:owner/repo.git
    // https://gitlab.example.com/owner/repo.git (self-hosted)

    // HTTPS format
    const httpsMatch = url.match(/gitlab\.[^/:]+[/:]([\w-]+)\/([\w.-]+?)(\.git)?$/)
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
      }
    }

    // Generic gitlab domain (self-hosted)
    const genericMatch = url.match(/\/\/([\w.-]+@)?([\w.-]+)\/([\w-]+)\/([\w.-]+?)(\.git)?$/)
    if (genericMatch && genericMatch[2].includes('gitlab')) {
      return {
        owner: genericMatch[3],
        repo: genericMatch[4],
      }
    }

    return null
  }
}
