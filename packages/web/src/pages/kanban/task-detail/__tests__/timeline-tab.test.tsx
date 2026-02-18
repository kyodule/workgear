import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TimelineEvent } from '@/lib/types'

// ─── Mocks ───

const mockGet = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => {
      mockGet(...args)
      return { json: () => mockGet._jsonImpl?.(...args) ?? Promise.resolve([]) }
    },
  },
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}))

// Import after mocks
import { TimelineTab } from '../timeline-tab'

// ─── Helpers ───

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'evt-1',
    taskId: 'task-1',
    flowRunId: null,
    nodeRunId: null,
    eventType: 'agent_message',
    content: 'Hello world',
    createdAt: '2026-02-18T10:00:00Z',
    ...overrides,
  }
}

function setupApi(events: TimelineEvent[]) {
  mockGet._jsonImpl = () => Promise.resolve(events)
}

// ─── Tests ───

describe('TimelineTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet._jsonImpl = undefined
  })

  it('显示加载状态', () => {
    // Never resolve the API call so loading stays true
    mockGet._jsonImpl = () => new Promise(() => {})
    render(<TimelineTab taskId="task-1" />)
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('空事件列表显示空状态提示', async () => {
    setupApi([])
    render(<TimelineTab taskId="task-1" />)
    await waitFor(() => {
      expect(screen.getByText('暂无时间线事件')).toBeInTheDocument()
    })
    expect(screen.getByText('启动流程后，事件将在此显示')).toBeInTheDocument()
  })

  it('默认折叠状态下，事件显示摘要而非完整内容', async () => {
    const events = [
      makeEvent({ id: 'evt-1', content: 'Short message' }),
      makeEvent({
        id: 'evt-2',
        eventType: 'agent_dispatch_completed',
        content: { selected_role: 'coder', reason: 'Best fit' } as any,
      }),
    ]
    setupApi(events)
    render(<TimelineTab taskId="task-1" />)

    await waitFor(() => {
      // String content summary visible
      expect(screen.getByText('Short message')).toBeInTheDocument()
    })

    // agent_dispatch_completed summary visible
    expect(screen.getByText('选中角色: coder')).toBeInTheDocument()

    // Full expanded content should NOT be visible (e.g. the reason field)
    expect(screen.queryByText('Best fit')).not.toBeInTheDocument()
  })

  it('点击事件头部后，事件展开显示完整内容', async () => {
    const user = userEvent.setup()
    const events = [
      makeEvent({
        id: 'evt-1',
        eventType: 'agent_dispatch_completed',
        content: { selected_role: 'reviewer', reason: 'Code review needed', fallback: false } as any,
      }),
    ]
    setupApi(events)
    render(<TimelineTab taskId="task-1" />)

    await waitFor(() => {
      expect(screen.getByText('选中角色: reviewer')).toBeInTheDocument()
    })

    // Full content not visible yet
    expect(screen.queryByText('Code review needed')).not.toBeInTheDocument()

    // Click the event header to expand
    const header = screen.getByText('Agent 分发').closest('div[class*="cursor-pointer"]')!
    await user.click(header)

    // Now full content should be visible
    expect(screen.getByText('Code review needed')).toBeInTheDocument()
  })

  it('再次点击事件头部后，事件折叠回摘要状态', async () => {
    const user = userEvent.setup()
    const events = [
      makeEvent({
        id: 'evt-1',
        eventType: 'agent_dispatch_completed',
        content: { selected_role: 'coder', reason: 'Implement feature' } as any,
      }),
    ]
    setupApi(events)
    render(<TimelineTab taskId="task-1" />)

    await waitFor(() => {
      expect(screen.getByText('选中角色: coder')).toBeInTheDocument()
    })

    const header = screen.getByText('Agent 分发').closest('div[class*="cursor-pointer"]')!

    // Expand
    await user.click(header)
    expect(screen.getByText('Implement feature')).toBeInTheDocument()

    // Collapse
    await user.click(header)
    expect(screen.queryByText('Implement feature')).not.toBeInTheDocument()
    // Summary should reappear
    expect(screen.getByText('选中角色: coder')).toBeInTheDocument()
  })

  it('agent_dispatch_completed 事件展开后显示结构化内容', async () => {
    const user = userEvent.setup()
    const events = [
      makeEvent({
        id: 'evt-1',
        eventType: 'agent_dispatch_completed',
        content: { selected_role: 'architect', reason: 'Design needed', fallback: true } as any,
      }),
    ]
    setupApi(events)
    render(<TimelineTab taskId="task-1" />)

    await waitFor(() => {
      expect(screen.getByText('选中角色: architect')).toBeInTheDocument()
    })

    const header = screen.getByText('Agent 分发').closest('div[class*="cursor-pointer"]')!
    await user.click(header)

    // Structured content: role badge, fallback indicator, reason
    const badges = screen.getAllByTestId('badge')
    const roleBadge = badges.find(b => b.textContent === 'architect')
    expect(roleBadge).toBeTruthy()
    expect(screen.getByText('⚠️ 降级策略')).toBeInTheDocument()
    expect(screen.getByText('Design needed')).toBeInTheDocument()
  })

  it('字符串内容超过100字符时摘要截断显示', async () => {
    const longContent = 'A'.repeat(150)
    const events = [makeEvent({ id: 'evt-1', content: longContent })]
    setupApi(events)
    render(<TimelineTab taskId="task-1" />)

    await waitFor(() => {
      const summary = 'A'.repeat(100) + '...'
      expect(screen.getByText(summary)).toBeInTheDocument()
    })
  })

  it('对象类型内容折叠时显示字段数量摘要', async () => {
    const events = [
      makeEvent({
        id: 'evt-1',
        eventType: 'system_event',
        content: { field1: 'a', field2: 'b', field3: 'c' } as any,
      }),
    ]
    setupApi(events)
    render(<TimelineTab taskId="task-1" />)

    await waitFor(() => {
      expect(screen.getByText('包含 3 个字段')).toBeInTheDocument()
    })
  })
})
