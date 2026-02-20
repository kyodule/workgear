/**
 * 验证 URL 是否安全，防止 SSRF 攻击
 */
export function validateUrlSafety(url: string): { valid: boolean; error?: string } {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    return { valid: false, error: '无效的 URL 格式' }
  }

  // 只允许 http 和 https 协议
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { valid: false, error: '仅支持 HTTP 和 HTTPS 协议' }
  }

  // 获取主机名
  const hostname = parsedUrl.hostname.toLowerCase()

  // 检查是否为 IP 地址
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const ipv4Match = hostname.match(ipv4Regex)

  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number)

    // 验证 IP 地址格式
    if (octets.some(octet => octet > 255)) {
      return { valid: false, error: '无效的 IP 地址' }
    }

    // 阻止私有 IP 地址段
    // 10.0.0.0/8
    if (octets[0] === 10) {
      return { valid: false, error: '不允许访问内网地址' }
    }

    // 172.16.0.0/12
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      return { valid: false, error: '不允许访问内网地址' }
    }

    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) {
      return { valid: false, error: '不允许访问内网地址' }
    }

    // 127.0.0.0/8 (localhost)
    if (octets[0] === 127) {
      return { valid: false, error: '不允许访问本地地址' }
    }

    // 169.254.0.0/16 (link-local)
    if (octets[0] === 169 && octets[1] === 254) {
      return { valid: false, error: '不允许访问链路本地地址' }
    }

    // 0.0.0.0/8
    if (octets[0] === 0) {
      return { valid: false, error: '不允许访问保留地址' }
    }

    // 224.0.0.0/4 (multicast)
    if (octets[0] >= 224 && octets[0] <= 239) {
      return { valid: false, error: '不允许访问组播地址' }
    }

    // 240.0.0.0/4 (reserved)
    if (octets[0] >= 240) {
      return { valid: false, error: '不允许访问保留地址' }
    }
  }

  // 检查 IPv6 本地地址
  if (hostname === '[::1]' || hostname === '::1') {
    return { valid: false, error: '不允许访问本地地址' }
  }

  // 检查常见的本地域名
  const localHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']
  if (localHostnames.includes(hostname)) {
    return { valid: false, error: '不允许访问本地地址' }
  }

  return { valid: true }
}
