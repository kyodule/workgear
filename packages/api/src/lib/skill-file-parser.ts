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
    const frontmatter = yaml.parse(frontmatterMatch[1])
    return {
      name: frontmatter.name || extractNameFromUrl(url),
      description: frontmatter.description || null,
      prompt: frontmatterMatch[2].trim(),
    }
  }

  // 降级：从 Markdown 标题提取
  const lines = content.split('\n')
  const titleMatch = lines[0]?.match(/^#\s+(.+)$/)
  const descMatch = lines[1]?.match(/<!--\s*Description:\s*(.+?)\s*-->/)

  return {
    name: titleMatch?.[1] || extractNameFromUrl(url),
    description: descMatch?.[1] || null,
    prompt: lines.slice(titleMatch ? 1 : 0).join('\n').trim(),
  }
}

function extractNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const fileName = pathname.split('/').pop() || 'Untitled'
    return fileName.replace(/\.(md|txt|yaml|yml)$/, '').replace(/[-_]/g, ' ')
  } catch {
    return 'Untitled'
  }
}
