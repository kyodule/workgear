import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Artifact, NodeRun } from '@/lib/types'

// ─── Mocks ───

// Mock api module
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => {
      mockGet(...args)
      return { json: () => mockGet._jsonImpl?.(...args) ?? Promise.resolve([]) }
    },
    post: (...args: any[]) => {
      mockPost(...args)
      return { json: () => Promise.resolve({}) }
    },
    put: (...args: any[]) => {
      mockPut(...args)
      return { json: () => Promise.resolve({}) }
    },
  },
}))

// Mock websocket hook
vi.mock('@/hooks/use-websocket', () => ({
  useFlowRunEvents: vi.fn(),
}))

// Mock heavy components to keep tests focused
vi.mock('@/components/node-log-dialog', () => ({
  NodeLogDialog: () => null,
}))

vi.mock('@/components/artifact-editor-dialog', () => ({
  ArtifactEditorDialog: () => null,
}))

vi.mock('@/components/flow-error-dialog', () => ({
  FlowErrorDialog: () => null,
}))

vi.mock('@/components/code-block', () => ({
  CodeBlock: ({ code }: { code: string }) => <pre data-testid="code-block">{code}</pre>,
}))

vi.mock('@/components/markdown-renderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="markdown-renderer">{content}</div>,
}))

vi.mock('@/components/artifact-preview-card', () => ({
  ArtifactPreviewCard: ({ artifact, onEdit, onFullscreen }: {
    artifact: Artifact
    onEdit?: (a: Artifact, content: string, version: number) => void
    onFullscreen?: (title: string, content: string) => void
  }) => (
    <div data-testid={`artifact-card-${artifact.id}`}>
      <span data-testid="artifact-title">{artifact.title}</span>
      {onEdit && (
        <button data-testid={`edit-btn-${artifact.id}`} onClick={() => onEdit(artifact, 'content', 1)}>
          编辑
        </button>
      )}
      {onFullscreen && (
        <button data-testid={`fullscreen-btn-${artifact.id}`} onClick={() => onFullscreen(artifact.title, 'content')}>
          全屏
        </button>
      )}
    </div>
  ),
}))

// Import after mocks
import { FlowTab } from '../flow-tab'

// ─── Test Data Factories ───

function makeNodeRun(overrides: Partial<NodeRun> = {}): NodeRun {
  return {
    id: 'node-run-1',
    flowRunId: 'flow-run-1',
    nodeId: 'node-1',
    nodeType: 'human_review',
    nodeName: '人工审核',
    status: 'waiting_human',
    attempt: 1,
    input: { review_target: { result: '{}' } },
    output: null,
    error: null,
    reviewAction: null,
    reviewComment: null,
    reviewedAt: null,
    startedAt: '2026-02-18T00:00:00Z',
    completedAt: null,
    createdAt: '2026-02-18T00:00:00Z',
    ...overrides,
  }
}

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'artifact-1',
    taskId: 'task-1',
    flowRunId: 'flow-run-1',
    nodeRunId: 'upstream-node-run-1',
    type: 'proposal',
    title: 'Test Proposal',
    filePath: null,
    createdAt: '2026-02-18T00:00:00Z',
    ...overrides,
  }
}

function makeFlowRun(overrides: Record<string, any> = {}) {
  return {
    id: 'flow-run-1',
    taskId: 'task-1',
    workflowId: 'wf-1',
    status: 'running',
    error: null,
    dslSnapshot: null,
    variables: null,
    branchName: null,
    prUrl: null,
    prNumber: null,
    prMergedAt: null,
    mergeCommitSha: null,
    startedAt: '2026-02-18T00:00:00Z',
    completedAt: null,
    createdAt: '2026-02-18T00:00:00Z',
    ...overrides,
  }
}

// ─── Setup API responses ───

function setupApiResponses({
  flowRuns = [makeFlowRun()],
  nodeRuns = [makeNodeRun()],
  nodeArtifacts = [] as Artifact[],
  flowArtifacts = [] as Artifact[],
}: {
  flowRuns?: any[]
  nodeRuns?: NodeRun[]
  nodeArtifacts?: Artifact[]
  flowArtifacts?: Artifact[]
} = {}) {
  mockGet._jsonImpl = (url: string) => {
    if (url.startsWith('flow-runs?taskId=')) return Promise.resolve(flowRuns)
    if (url.match(/^flow-runs\/[^/]+\/nodes$/)) return Promise.resolve(nodeRuns)
    if (url.startsWith('artifacts?nodeRunId=')) return Promise.resolve(nodeArtifacts)
    if (url.startsWith('artifacts?flowRunId=')) return Promise.resolve(flowArtifacts)
    return Promise.resolve([])
  }
}

// ─── Tests ───

describe('FlowTab - Artifact Review Display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet._jsonImpl = undefined
  })

  it('hides input JSON when artifacts are present', async () => {
    const artifacts = [
      makeArtifact({ id: 'a1', title: 'Proposal Doc' }),
    ]

    const allNodes = [
      makeNodeRun({ id: 'upstream-node-run-1', nodeId: 'agent-1', nodeType: 'agent_task', nodeName: '代码生成', status: 'completed' }),
      makeNodeRun(),
    ]

    setupApiResponses({
      nodeRuns: allNodes,
      nodeArtifacts: [],
      flowArtifacts: artifacts,
    })

    render(<FlowTab taskId="task-1" onFullscreen={vi.fn()} />)

    // Wait for artifacts to load
    await waitFor(() => {
      expect(screen.getByTestId('artifact-card-a1')).toBeInTheDocument()
    })

    // Input JSON (code-block with "待审核内容") should NOT be visible
    expect(screen.queryByText('待审核内容')).not.toBeInTheDocument()
  })

  it('shows input JSON when no artifacts are present', async () => {
    setupApiResponses({
      nodeRuns: [makeNodeRun()],
      nodeArtifacts: [],
      flowArtifacts: [],
    })

    render(<FlowTab taskId="task-1" onFullscreen={vi.fn()} />)

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText('待审核内容')).toBeInTheDocument()
    })

    // Code block should be visible
    expect(screen.getByTestId('code-block')).toBeInTheDocument()
  })

  it('performs double-query and merges artifacts for human_review nodes', async () => {
    const nodeArtifact = makeArtifact({ id: 'a-node', nodeRunId: 'node-run-1', title: 'Node Artifact' })
    const flowArtifact = makeArtifact({ id: 'a-flow', nodeRunId: 'upstream-node-run-1', title: 'Flow Artifact' })

    const allNodes = [
      makeNodeRun({ id: 'upstream-node-run-1', nodeId: 'agent-1', nodeType: 'agent_task', nodeName: '代码生成', status: 'completed' }),
      makeNodeRun({ id: 'node-run-1', nodeId: 'node-1', nodeType: 'human_review', nodeName: '人工审核', status: 'waiting_human' }),
    ]

    setupApiResponses({
      nodeRuns: allNodes,
      nodeArtifacts: [nodeArtifact],
      flowArtifacts: [nodeArtifact, flowArtifact], // flowRunId query returns both
    })

    render(<FlowTab taskId="task-1" onFullscreen={vi.fn()} />)

    // Both artifacts should be displayed (merged, deduplicated)
    await waitFor(() => {
      expect(screen.getByTestId('artifact-card-a-node')).toBeInTheDocument()
      expect(screen.getByTestId('artifact-card-a-flow')).toBeInTheDocument()
    })

    // Verify both nodeRunId and flowRunId queries were made
    const getCalls = mockGet.mock.calls.map((c: any[]) => c[0])
    expect(getCalls.some((url: string) => url.startsWith('artifacts?nodeRunId='))).toBe(true)
    expect(getCalls.some((url: string) => url.startsWith('artifacts?flowRunId='))).toBe(true)
  })

  it('does not show edit button when human_review node is completed', async () => {
    const completedNode = makeNodeRun({
      status: 'completed',
      reviewAction: 'approve',
      output: { result: 'approved' },
      completedAt: '2026-02-18T01:00:00Z',
    })

    const upstreamNode = makeNodeRun({ 
      id: 'upstream-node-run-1', 
      nodeId: 'agent-1', 
      nodeType: 'agent_task', 
      nodeName: '代码生成', 
      status: 'completed' 
    })

    const artifacts = [
      makeArtifact({ id: 'a1', title: 'Completed Artifact', nodeRunId: 'upstream-node-run-1' }),
    ]

    setupApiResponses({
      flowRuns: [makeFlowRun({ status: 'completed' })],
      nodeRuns: [upstreamNode, completedNode],
      nodeArtifacts: [],
      flowArtifacts: artifacts,
    })

    render(<FlowTab taskId="task-1" onFullscreen={vi.fn()} />)

    // Wait for both nodes to appear
    await waitFor(() => {
      expect(screen.getByText('代码生成')).toBeInTheDocument()
      expect(screen.getByText('人工审核')).toBeInTheDocument()
    })

    // Find the human review node's clickable area (the parent div)
    const humanReviewNode = screen.getByText('人工审核').closest('.cursor-pointer')
    expect(humanReviewNode).toBeInTheDocument()

    // Click to expand
    const user = userEvent.setup()
    await user.click(humanReviewNode!)

    // Wait for artifacts to load
    await waitFor(() => {
      expect(screen.getByTestId('artifact-card-a1')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Edit button should NOT be present (completed state)
    expect(screen.queryByTestId('edit-btn-a1')).not.toBeInTheDocument()

    // Fullscreen button should still be present
    expect(screen.getByTestId('fullscreen-btn-a1')).toBeInTheDocument()
  })

  it('shows edit button when human_review node is waiting_human', async () => {
    const artifacts = [
      makeArtifact({ id: 'a1', title: 'Editable Artifact' }),
    ]

    const allNodes = [
      makeNodeRun({ id: 'upstream-node-run-1', nodeId: 'agent-1', nodeType: 'agent_task', nodeName: '代码生成', status: 'completed' }),
      makeNodeRun(),
    ]

    setupApiResponses({
      nodeRuns: allNodes,
      nodeArtifacts: [],
      flowArtifacts: artifacts,
    })

    render(<FlowTab taskId="task-1" onFullscreen={vi.fn()} />)

    // Wait for artifacts to load (node auto-expands for waiting_human)
    await waitFor(() => {
      expect(screen.getByTestId('artifact-card-a1')).toBeInTheDocument()
    })

    // Edit button should be present (waiting_human state)
    expect(screen.getByTestId('edit-btn-a1')).toBeInTheDocument()
  })

  it('groups artifacts by source node with group titles', async () => {
    const artifacts = [
      makeArtifact({ id: 'a1', nodeRunId: 'upstream-1', title: 'Proposal', createdAt: '2026-02-18T00:01:00Z' }),
      makeArtifact({ id: 'a2', nodeRunId: 'upstream-1', title: 'Design', createdAt: '2026-02-18T00:02:00Z' }),
      makeArtifact({ id: 'a3', nodeRunId: 'upstream-2', title: 'Tasks', createdAt: '2026-02-18T00:03:00Z' }),
    ]

    const allNodes = [
      makeNodeRun({ id: 'upstream-1', nodeId: 'agent-1', nodeType: 'agent_task', nodeName: '需求分析', status: 'completed', createdAt: '2026-02-18T00:00:00Z' }),
      makeNodeRun({ id: 'upstream-2', nodeId: 'agent-2', nodeType: 'agent_task', nodeName: '任务拆分', status: 'completed', createdAt: '2026-02-18T00:01:00Z' }),
      makeNodeRun({ id: 'node-run-1', nodeId: 'node-1', nodeType: 'human_review', nodeName: '人工审核', status: 'waiting_human' }),
    ]

    setupApiResponses({
      nodeRuns: allNodes,
      nodeArtifacts: [],
      flowArtifacts: artifacts,
    })

    render(<FlowTab taskId="task-1" onFullscreen={vi.fn()} />)

    // Wait for artifacts to load
    await waitFor(() => {
      expect(screen.getByTestId('artifact-card-a1')).toBeInTheDocument()
      expect(screen.getByTestId('artifact-card-a2')).toBeInTheDocument()
      expect(screen.getByTestId('artifact-card-a3')).toBeInTheDocument()
    })

    // Group titles should be visible (wait longer for the nested useEffect in ArtifactsBySourceNode)
    // Note: These node names also appear in the node list, so we check for multiple occurrences
    await waitFor(() => {
      const xuqiufenxi = screen.getAllByText('需求分析')
      const renwuchaifeng = screen.getAllByText('任务拆分')
      // Should appear at least twice: once in node list, once as group title
      expect(xuqiufenxi.length).toBeGreaterThanOrEqual(2)
      expect(renwuchaifeng.length).toBeGreaterThanOrEqual(2)
    }, { timeout: 3000 })
  })
})
