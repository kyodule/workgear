import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraggableResizableDialog } from '../draggable-resizable-dialog'

// Mock react-rnd since jsdom doesn't support the layout measurements it needs
interface RndMockProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  default?: { x: number; y: number; width: number; height: number }
  minWidth?: number
  minHeight?: number
  bounds?: string
  dragHandleClassName?: string
}

vi.mock('react-rnd', () => ({
  Rnd: ({
    children,
    className,
    style,
    default: defaultPos,
    minWidth,
    minHeight,
    bounds,
    dragHandleClassName,
  }: RndMockProps) => (
    <div
      data-testid="rnd-container"
      className={className}
      style={{
        ...style,
        width: defaultPos?.width,
        height: defaultPos?.height,
      }}
      data-default-x={defaultPos?.x}
      data-default-y={defaultPos?.y}
      data-default-width={defaultPos?.width}
      data-default-height={defaultPos?.height}
      data-min-width={minWidth}
      data-min-height={minHeight}
      data-bounds={bounds}
      data-drag-handle={dragHandleClassName}
    >
      {children}
    </div>
  ),
}))

describe('DraggableResizableDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Test Dialog',
    children: <div>Dialog content</div>,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Rendering ---

  it('renders nothing when open is false', () => {
    render(
      <DraggableResizableDialog {...defaultProps} open={false}>
        <div>Hidden content</div>
      </DraggableResizableDialog>,
    )
    expect(screen.queryByTestId('draggable-resizable-dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
  })

  it('renders dialog when open is true', () => {
    render(<DraggableResizableDialog {...defaultProps} />)
    expect(screen.getByTestId('draggable-resizable-dialog')).toBeInTheDocument()
    expect(screen.getByText('Test Dialog')).toBeInTheDocument()
    expect(screen.getByText('Dialog content')).toBeInTheDocument()
  })

  it('renders overlay by default', () => {
    render(<DraggableResizableDialog {...defaultProps} />)
    expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument()
  })

  it('hides overlay when overlay=false', () => {
    render(<DraggableResizableDialog {...defaultProps} overlay={false} />)
    expect(screen.queryByTestId('dialog-overlay')).not.toBeInTheDocument()
  })

  // --- Accessibility ---

  it('has role="dialog" and aria-modal="true"', () => {
    render(<DraggableResizableDialog {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('associates title via aria-labelledby', () => {
    render(<DraggableResizableDialog {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    // The element referenced by aria-labelledby should contain the title text
    const titleEl = document.getElementById(labelledBy!)
    expect(titleEl).toBeInTheDocument()
    expect(titleEl).toHaveTextContent('Test Dialog')
  })

  it('close button has aria-label', () => {
    render(<DraggableResizableDialog {...defaultProps} />)
    const closeBtn = screen.getByTestId('dialog-close-button')
    expect(closeBtn).toHaveAttribute('aria-label', '关闭')
  })

  // --- Close behaviors ---

  it('calls onOpenChange(false) when ESC is pressed', async () => {
    const onOpenChange = vi.fn()
    render(
      <DraggableResizableDialog {...defaultProps} onOpenChange={onOpenChange} />,
    )
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when close button is clicked', async () => {
    const onOpenChange = vi.fn()
    render(
      <DraggableResizableDialog {...defaultProps} onOpenChange={onOpenChange} />,
    )
    await userEvent.click(screen.getByTestId('dialog-close-button'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when overlay is clicked', async () => {
    const onOpenChange = vi.fn()
    render(
      <DraggableResizableDialog {...defaultProps} onOpenChange={onOpenChange} />,
    )
    await userEvent.click(screen.getByTestId('dialog-overlay'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // --- Reopen resets default size ---

  it('resets to default size/position on reopen (key changes)', () => {
    const { rerender } = render(
      <DraggableResizableDialog {...defaultProps} open={true} />,
    )
    // Close
    rerender(
      <DraggableResizableDialog {...defaultProps} open={false} />,
    )
    expect(screen.queryByTestId('draggable-resizable-dialog')).not.toBeInTheDocument()

    // Reopen — Rnd remounts due to key={String(open)}
    rerender(
      <DraggableResizableDialog {...defaultProps} open={true} />,
    )
    const rnd = screen.getByTestId('rnd-container')
    // Default values should be applied again
    expect(rnd.getAttribute('data-default-width')).toBe('672')
    expect(rnd.getAttribute('data-default-height')).toBe('480')
  })

  // --- Custom sizes ---

  it('passes custom defaultWidth/defaultHeight to Rnd', () => {
    render(
      <DraggableResizableDialog
        {...defaultProps}
        defaultWidth={896}
        defaultHeight={600}
      />,
    )
    const rnd = screen.getByTestId('rnd-container')
    expect(rnd.getAttribute('data-default-width')).toBe('896')
    expect(rnd.getAttribute('data-default-height')).toBe('600')
  })

  it('passes minWidth/minHeight to Rnd', () => {
    render(
      <DraggableResizableDialog
        {...defaultProps}
        minWidth={480}
        minHeight={320}
      />,
    )
    const rnd = screen.getByTestId('rnd-container')
    expect(rnd.getAttribute('data-min-width')).toBe('480')
    expect(rnd.getAttribute('data-min-height')).toBe('320')
  })

  it('sets bounds="window" on Rnd', () => {
    render(<DraggableResizableDialog {...defaultProps} />)
    const rnd = screen.getByTestId('rnd-container')
    expect(rnd.getAttribute('data-bounds')).toBe('window')
  })

  it('sets dragHandleClassName on Rnd', () => {
    render(<DraggableResizableDialog {...defaultProps} />)
    const rnd = screen.getByTestId('rnd-container')
    expect(rnd.getAttribute('data-drag-handle')).toBe('drag-handle')
  })

  // --- className applies to content area ---

  it('applies className to content area, not outer container', () => {
    render(
      <DraggableResizableDialog {...defaultProps} className="custom-content" />,
    )
    // Content area should have the custom class
    const contentArea = screen.getByText('Dialog content').parentElement
    expect(contentArea).toHaveClass('custom-content')

    // Outer Rnd container should NOT have the custom class
    const rnd = screen.getByTestId('rnd-container')
    expect(rnd).not.toHaveClass('custom-content')
  })

  it('applies containerClassName to outer Rnd container', () => {
    render(
      <DraggableResizableDialog
        {...defaultProps}
        containerClassName="custom-container"
      />,
    )
    const rnd = screen.getByTestId('rnd-container')
    expect(rnd.className).toContain('custom-container')
  })

  // --- Viewport clamping ---

  it('clamps initial position to non-negative values on small viewports', () => {
    // Simulate a narrow viewport (400px wide, 300px tall)
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 300, writable: true })

    render(
      <DraggableResizableDialog
        {...defaultProps}
        defaultWidth={896}
        defaultHeight={600}
      />,
    )
    const rnd = screen.getByTestId('rnd-container')
    const x = Number(rnd.getAttribute('data-default-x'))
    const y = Number(rnd.getAttribute('data-default-y'))
    const w = Number(rnd.getAttribute('data-default-width'))
    const h = Number(rnd.getAttribute('data-default-height'))

    // Position should never be negative
    expect(x).toBeGreaterThanOrEqual(0)
    expect(y).toBeGreaterThanOrEqual(0)
    // Size should be clamped to viewport
    expect(w).toBeLessThanOrEqual(400)
    expect(h).toBeLessThanOrEqual(300)

    // Restore
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
  })

  // --- Focus management ---

  it('focuses the dialog when opened', async () => {
    render(<DraggableResizableDialog {...defaultProps} />)
    // Wait for requestAnimationFrame focus
    await new Promise((r) => setTimeout(r, 50))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveFocus()
  })

  it('restores focus to previously focused element on close', async () => {
    // Create a button that will be focused before dialog opens
    const { rerender } = render(
      <>
        <button data-testid="trigger-btn">Trigger</button>
        <DraggableResizableDialog {...defaultProps} open={false} />
      </>,
    )

    // Focus the trigger button
    const triggerBtn = screen.getByTestId('trigger-btn')
    triggerBtn.focus()
    expect(triggerBtn).toHaveFocus()

    // Open dialog — should capture previousFocus and move focus to dialog
    rerender(
      <>
        <button data-testid="trigger-btn">Trigger</button>
        <DraggableResizableDialog {...defaultProps} open={true} />
      </>,
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByRole('dialog')).toHaveFocus()

    // Close dialog — should restore focus to trigger button
    rerender(
      <>
        <button data-testid="trigger-btn">Trigger</button>
        <DraggableResizableDialog {...defaultProps} open={false} />
      </>,
    )
    expect(triggerBtn).toHaveFocus()
  })
})
