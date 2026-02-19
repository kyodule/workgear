import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 检测当前设备是否为移动端
 * @param breakpoint 断点宽度（默认 768px）
 * @returns 是否为移动端
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  )
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const checkMobile = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsMobile(window.innerWidth < breakpoint)
    }, 150)
  }, [breakpoint])

  useEffect(() => {
    // Initial check
    setIsMobile(window.innerWidth < breakpoint)

    window.addEventListener('resize', checkMobile)
    return () => {
      window.removeEventListener('resize', checkMobile)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [breakpoint, checkMobile])

  return isMobile
}

/**
 * 检测当前设备类型
 * @returns 设备类型：mobile | tablet | desktop
 */
export function useDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop'
    const width = window.innerWidth
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  })
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const checkDeviceType = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      const width = window.innerWidth
      if (width < 768) setDeviceType('mobile')
      else if (width < 1024) setDeviceType('tablet')
      else setDeviceType('desktop')
    }, 150)
  }, [])

  useEffect(() => {
    const width = window.innerWidth
    if (width < 768) setDeviceType('mobile')
    else if (width < 1024) setDeviceType('tablet')
    else setDeviceType('desktop')

    window.addEventListener('resize', checkDeviceType)
    return () => {
      window.removeEventListener('resize', checkDeviceType)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [checkDeviceType])

  return deviceType
}
