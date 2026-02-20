import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { skills } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { parseSkillFile } from '../lib/skill-file-parser.js'

export default async function skillsRoutes(app: FastifyInstance) {
  // GET /api/skills - 获取所有 Skills
  app.get('/api/skills', async (req, res) => {
    const allSkills = await db.select().from(skills)
    res.send(allSkills)
  })

  // GET /api/skills/:id - 获取单个 Skill
  app.get<{ Params: { id: string } }>('/api/skills/:id', async (req, res) => {
    const skill = await db.select().from(skills).where(eq(skills.id, req.params.id))

    if (skill.length === 0) {
      return res.status(404).send({ error: 'Skill not found' })
    }

    res.send(skill[0])
  })

  // POST /api/skills/import-from-url - 从 URL 解析 Skill
  app.post<{ Body: { url: string } }>('/api/skills/import-from-url', async (req, res) => {
    const { url } = req.body

    // 校验 URL 格式
    try {
      new URL(url)
    } catch {
      return res.status(400).send({ error: '无效的 URL 格式' })
    }

    // 后端 fetch 文件内容
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)

      if (!response.ok) {
        return res.status(400).send({ error: `无法访问该 URL（HTTP ${response.status}）` })
      }

      const content = await response.text()

      // 文件大小检查
      if (content.length > 1024 * 1024) {
        return res.status(400).send({ error: '文件大小超过 1MB 限制' })
      }

      // 检测是否为 HTML 页面
      if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
        return res.status(400).send({ error: '该 URL 返回的是 HTML 页面，请使用文件的 raw URL' })
      }

      // 解析文件
      const metadata = parseSkillFile(content, url)

      res.send({
        name: metadata.name,
        description: metadata.description,
        prompt: metadata.prompt,
        sourceUrl: url,
      })
    } catch (error: any) {
      clearTimeout(timeout)
      if (error.name === 'AbortError') {
        return res.status(400).send({ error: 'URL 请求超时（10s）' })
      }
      return res.status(400).send({ error: `无法访问该 URL: ${error.message}` })
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

    // 检查同名 Skill
    const existing = await db.select().from(skills).where(eq(skills.name, name))

    if (existing.length > 0) {
      if (conflictStrategy === 'skip') {
        return res.send({ skipped: true, skill: existing[0] })
      }

      if (conflictStrategy === 'overwrite') {
        const updated = await db
          .update(skills)
          .set({
            description: description || null,
            prompt,
            sourceUrl: sourceUrl || null,
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
        name,
        description: description || null,
        prompt,
        sourceUrl: sourceUrl || null,
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
    const { name, description, prompt } = req.body

    const updated = await db
      .update(skills)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(prompt !== undefined && { prompt }),
        updatedAt: new Date(),
      })
      .where(eq(skills.id, req.params.id))
      .returning()

    if (updated.length === 0) {
      return res.status(404).send({ error: 'Skill not found' })
    }

    res.send(updated[0])
  })

  // DELETE /api/skills/:id - 删除 Skill
  app.delete<{ Params: { id: string } }>('/api/skills/:id', async (req, res) => {
    const deleted = await db
      .delete(skills)
      .where(eq(skills.id, req.params.id))
      .returning()

    if (deleted.length === 0) {
      return res.status(404).send({ error: 'Skill not found' })
    }

    res.status(204).send()
  })
}
