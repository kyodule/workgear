import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { skills } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { parseSkillFile } from '../lib/skill-file-parser.js'
import { validateUrlSafety } from '../lib/url-validator.js'
import { validateUuid } from '../lib/uuid-validator.js'

export default async function skillsRoutes(app: FastifyInstance) {
  // GET /api/skills - 获取所有 Skills
  app.get('/api/skills', async (req, res) => {
    const allSkills = await db.select().from(skills)
    res.send(allSkills)
  })

  // GET /api/skills/:id - 获取单个 Skill
  app.get<{ Params: { id: string } }>('/api/skills/:id', async (req, res) => {
    const { id } = req.params

    // 验证 UUID 格式
    if (!validateUuid(id)) {
      return res.status(400).send({ error: '无效的 Skill ID 格式' })
    }

    const skill = await db.select().from(skills).where(eq(skills.id, id))

    if (skill.length === 0) {
      return res.status(404).send({ error: 'Skill 未找到' })
    }

    res.send(skill[0])
  })

  // POST /api/skills/import-from-url - 从 URL 解析 Skill
  app.post<{ Body: { url: string } }>('/api/skills/import-from-url', async (req, res) => {
    const { url } = req.body

    // 校验 URL 是否存在
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).send({ error: '请提供有效的 URL' })
    }

    // 校验 URL 格式和安全性（防止 SSRF）
    const urlValidation = validateUrlSafety(url.trim())
    if (!urlValidation.valid) {
      return res.status(400).send({ error: urlValidation.error })
    }

    // 后端 fetch 文件内容
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(url.trim(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'WorkGear-SkillImporter/1.0',
        },
      })
      clearTimeout(timeout)

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(400).send({ error: '文件不存在（404），请检查 URL 是否正确' })
        }
        if (response.status === 403) {
          return res.status(400).send({ error: '无权访问该文件（403），请确保文件为公开访问' })
        }
        return res.status(400).send({ error: `无法访问该 URL（HTTP ${response.status}）` })
      }

      // 检查 Content-Length 限制（1MB）
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
        return res.status(400).send({ error: '文件大小超过 1MB 限制' })
      }

      const content = await response.text()

      // 二次检查文件大小（防止没有 Content-Length 的情况）
      if (content.length > 1024 * 1024) {
        return res.status(400).send({ error: '文件大小超过 1MB 限制' })
      }

      // 检查内容是否为空
      if (!content.trim()) {
        return res.status(400).send({ error: '文件内容为空' })
      }

      // 检测是否为 HTML 页面
      const trimmedContent = content.trim()
      const lowerContent = trimmedContent.toLowerCase()
      if (lowerContent.startsWith('<!doctype') ||
          lowerContent.startsWith('<html')) {
        return res.status(400).send({ error: '该 URL 返回的是 HTML 页面，请使用文件的 raw URL' })
      }

      // 解析文件
      const metadata = parseSkillFile(content, url.trim())

      // 验证解析结果
      if (!metadata.name || !metadata.name.trim()) {
        return res.status(400).send({ error: '无法从文件中提取有效的 Skill 名称' })
      }

      if (!metadata.prompt || !metadata.prompt.trim()) {
        return res.status(400).send({ error: '文件内容无效，无法提取 Prompt' })
      }

      res.send({
        name: metadata.name.trim(),
        description: metadata.description?.trim() || null,
        prompt: metadata.prompt.trim(),
        sourceUrl: url.trim(),
      })
    } catch (error: any) {
      clearTimeout(timeout)
      if (error.name === 'AbortError') {
        return res.status(400).send({ error: 'URL 请求超时（10秒），请检查网络连接或稍后重试' })
      }
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(400).send({ error: '无法连接到该 URL，请检查地址是否正确' })
      }
      return res.status(400).send({ error: `无法访问该 URL：${error.message}` })
    }
  })

  // POST /api/skills - 创建 Skill
  app.post<{
    Body: {
      name: string
      description?: string | null
      prompt: string
      sourceUrl?: string
      conflictStrategy?: 'skip' | 'overwrite'
    }
  }>('/api/skills', async (req, res) => {
    const { name, description, prompt, sourceUrl, conflictStrategy } = req.body

    // 验证必填字段
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).send({ error: 'Skill 名称不能为空' })
    }

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).send({ error: 'Prompt 内容不能为空' })
    }

    // 验证名称长度
    if (name.trim().length > 200) {
      return res.status(400).send({ error: 'Skill 名称不能超过 200 个字符' })
    }

    // 检查同名 Skill
    const existing = await db.select().from(skills).where(eq(skills.name, name.trim()))

    if (existing.length > 0) {
      if (conflictStrategy === 'skip') {
        return res.send({ skipped: true, skill: existing[0] })
      }

      if (conflictStrategy === 'overwrite') {
        const updated = await db
          .update(skills)
          .set({
            description: description?.trim() || null,
            prompt: prompt.trim(),
            sourceUrl: sourceUrl?.trim() || null,
            updatedAt: new Date(),
          })
          .where(eq(skills.id, existing[0].id))
          .returning()

        return res.send(updated[0])
      }

      return res.status(409).send({ error: 'Skill 名称已存在' })
    }

    // 创建新 Skill
    const newSkill = await db
      .insert(skills)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        prompt: prompt.trim(),
        sourceUrl: sourceUrl?.trim() || null,
      })
      .returning()

    res.status(201).send(newSkill[0])
  })

  // PUT /api/skills/:id - 更新 Skill
  app.put<{
    Params: { id: string }
    Body: {
      name?: string
      description?: string | null
      prompt?: string
    }
  }>('/api/skills/:id', async (req, res) => {
    const { id } = req.params
    const { name, description, prompt } = req.body

    // 验证 UUID 格式
    if (!validateUuid(id)) {
      return res.status(400).send({ error: '无效的 Skill ID 格式' })
    }

    // 验证字段
    if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
      return res.status(400).send({ error: 'Skill 名称不能为空' })
    }

    if (name !== undefined && name.trim().length > 200) {
      return res.status(400).send({ error: 'Skill 名称不能超过 200 个字符' })
    }

    if (prompt !== undefined && (!prompt || typeof prompt !== 'string' || !prompt.trim())) {
      return res.status(400).send({ error: 'Prompt 内容不能为空' })
    }

    const updated = await db
      .update(skills)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(prompt !== undefined && { prompt: prompt.trim() }),
        updatedAt: new Date(),
      })
      .where(eq(skills.id, id))
      .returning()

    if (updated.length === 0) {
      return res.status(404).send({ error: 'Skill 未找到' })
    }

    res.send(updated[0])
  })

  // DELETE /api/skills/:id - 删除 Skill
  app.delete<{ Params: { id: string } }>('/api/skills/:id', async (req, res) => {
    const { id } = req.params

    // 验证 UUID 格式
    if (!validateUuid(id)) {
      return res.status(400).send({ error: '无效的 Skill ID 格式' })
    }

    const deleted = await db
      .delete(skills)
      .where(eq(skills.id, id))
      .returning()

    if (deleted.length === 0) {
      return res.status(404).send({ error: 'Skill 未找到' })
    }

    res.status(204).send()
  })
}
