import bcrypt from 'bcrypt'
import { db } from '../db/index.js'
import { client } from '../db/index.js'
import { users, projects, projectMembers, kanbans, kanbanColumns } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@workgear.dev'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'workgear2026'
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin'

export async function runBootstrapSeed() {
  console.log('🚀 Starting bootstrap seed...')

  // 1. 创建管理员账号（如果不存在）
  const [existingUser] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL.toLowerCase()))

  let adminId: string

  if (existingUser) {
    adminId = existingUser.id
    console.log(`✅ Admin user already exists: ${ADMIN_EMAIL}`)
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
    const [admin] = await db.insert(users).values({
      email: ADMIN_EMAIL.toLowerCase(),
      name: ADMIN_NAME,
      passwordHash,
    }).returning()
    adminId = admin.id
    console.log(`✅ Created admin user: ${ADMIN_EMAIL}`)
  }

  // 2. 创建 WorkGear 自举项目（如果不存在）
  const [existingProject] = await db.select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, 'WorkGear'))

  if (existingProject) {
    console.log('✅ WorkGear bootstrap project already exists')
  } else {
    const [project] = await db.insert(projects).values({
      name: 'WorkGear',
      description: 'WorkGear AI Agent 工作流编排平台 — 用自身管理自身的迭代开发',
      gitRepoUrl: 'https://github.com/sunshow/workgear.git',
      visibility: 'public',
      ownerId: adminId,
    }).returning()

    // 创建 owner 成员关系
    await db.insert(projectMembers).values({
      projectId: project.id,
      userId: adminId,
      role: 'owner',
    })

    // 创建默认看板
    const [kanban] = await db.insert(kanbans).values({
      projectId: project.id,
      name: 'Default Board',
    }).returning()

    // 创建默认列
    const defaultColumns = ['Backlog', 'In Progress', 'Review', 'Done']
    await db.insert(kanbanColumns).values(
      defaultColumns.map((colName, idx) => ({
        kanbanId: kanban.id,
        name: colName,
        position: idx,
      }))
    )

    console.log(`✅ Created WorkGear bootstrap project (public, id: ${project.id})`)
  }

  console.log('🎉 Bootstrap seed complete!')
}

// 独立执行入口
const isMain = process.argv[1]?.endsWith('seed-bootstrap.ts') || process.argv[1]?.endsWith('seed-bootstrap.js')
if (isMain) {
  runBootstrapSeed()
    .then(() => client.end())
    .catch(async (err) => {
      console.error('❌ Bootstrap seed failed:', err)
      await client.end()
      process.exit(1)
    })
}
