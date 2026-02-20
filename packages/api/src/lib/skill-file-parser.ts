import yaml from 'yaml'

interface SkillMetadata {
  name: string
  description: string | null
  prompt: string
}

export function parseSkillFile(content: string, url: string): SkillMetadata {
  // 检测 YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/)

  if (frontmatterMatch) {
    try {
      const frontmatter = yaml.parse(frontmatterMatch[1])
      const name = frontmatter.name?.trim() || extractNameFromUrl(url)
      const description = frontmatter.description?.trim() || null
      const prompt = frontmatterMatch[2].trim()

      return {
        name,
        description: description || null,
        prompt: prompt || content.trim(),
      }
    } catch (error) {
      // YAML 解析失败，降级到 Markdown 解析
    }
  }

  // 降级：从 Markdown 标题提取
  const lines = content.split('\n')
  const titleMatch = lines[0]?.match(/^#\s+(.+)$/)
  const descMatch = lines[1]?.match(/<!--\s*Description:\s*(.+?)\s*-->/)

  const name = titleMatch?.[1]?.trim() || extractNameFromUrl(url)
  const description = descMatch?.[1]?.trim() || null

  // 如果有标题，从第二行开始作为 prompt；否则整个内容作为 prompt
  let prompt = lines.slice(titleMatch ? 1 : 0).join('\n').trim()

  // 如果有描述注释，移除它
  if (descMatch) {
    prompt = prompt.replace(/<!--\s*Description:\s*.+?\s*-->\n?/, '').trim()
  }

  return {
    name,
    description: description || null,
    prompt: prompt || content.trim(),
  }
}

function extractNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const fileName = pathname.split('/').pop() || 'Untitled'
    const nameWithoutExt = fileName.replace(/\.(md|txt|yaml|yml)$/i, '')
    const cleanName = nameWithoutExt.replace(/[-_]/g, ' ').trim()
    return cleanName || 'Untitled'
  } catch {
    return 'Untitled'
  }
}
