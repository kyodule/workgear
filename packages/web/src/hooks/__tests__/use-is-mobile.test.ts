import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile, useDeviceType } from '../use-is-mobile'

describe('useIsMobile', () => {
  let originalInnerWidth: number

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
    vi.useFakeTimers()
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
    vi.useRealTimers()
  })

  function setWindowWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
  }

  it('should return true when window width < 768px', () => {
    setWindowWidth(375)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('should return false when window width >= 768px', () => {
    setWindowWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('should return false when window width is exactly 768px', () => {
    setWindowWidth(768)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('should support custom breakpoint', () => {
    setWindowWidth(500)
    const { result } = renderHook(() => useIsMobile(480))
    expect(result.current).toBe(false)

    setWindowWidth(400)
    const { result: result2 } = renderHook(() => useIsMobile(480))
    expect(result2.current).toBe(true)
  })

  it('should update when window is resized (with debounce)', () => {
    setWindowWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    // Resize to mobile
    act(() => {
      setWindowWidth(375)
      window.dispatchEvent(new Event('resize'))
    })

    // Should not update immediately (debounced)
    expect(result.current).toBe(false)

    // Advance past debounce timer (150ms)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current).toBe(true)
  })

  it('should update when resized from mobile to desktop', () => {
    setWindowWidth(375)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    act(() => {
      setWindowWidth(1024)
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(150)
    })

    expect(result.current).toBe(false)
  })

  it('should clean up event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    setWindowWidth(375)
    const { unmount } = renderHook(() => useIsMobile())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    removeEventListenerSpy.mockRestore()
  })
})

describe('useDeviceType', () => {
  let originalInnerWidth: number

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
    vi.useFakeTimers()
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
    vi.useRealTimers()
  })

  function setWindowWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
  }

  it('should return "mobile" when width < 768px', () => {
    setWindowWidth(375)
    const { result } = renderHook(() => useDeviceType())
    expect(result.current).toBe('mobile')
  })

  it('should return "tablet" when width >= 768px and < 1024px', () => {
    setWindowWidth(768)
    const { result } = renderHook(() => useDeviceType())
    expect(result.current).toBe('tablet')
  })

  it('should return "desktop" when width >= 1024px', () => {
    setWindowWidth(1024)
    const { result } = renderHook(() => useDeviceType())
    expect(result.current).toBe('desktop')
  })

  it('should update device type on resize with debounce', () => {
    setWindowWidth(1024)
    const { result } = renderHook(() => useDeviceType())
    expect(result.current).toBe('desktop')

    // Resize to tablet
    act(() => {
      setWindowWidth(800)
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe('tablet')

    // Resize to mobile
    act(() => {
      setWindowWidth(375)
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe('mobile')
  })
})
