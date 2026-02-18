import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { db } from '../db/index.js'
import { client } from '../db/index.js'
import { workflowTemplates } from '../db/schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface TemplateDefinition {
  slug: string
  name: string
  description: string
  category: string
  difficulty: string
  estimatedTime: string
  parameters: Array<{
    name: string
    type: string
    label: string
    default?: any
    options?: string[]
    required?: boolean
  }>
}

const templates: TemplateDefinition[] = [
  {
    slug: 'simple-dev-pipeline',
    name: '简单开发流水线',
    description: '需求输入 → Agent 分析 → 人工确认 → Agent 执行 → 人工 Review',
    category: 'development',
    difficulty: 'beginner',
    estimatedTime: '2-4 小时',
    parameters: [
      {
        name: 'analyst_role',
        type: 'text',
        label: 'Agent 分析师角色',
        default: 'requirement-analyst',
        required: true,
      },
      {
        name: 'developer_role',
        type: 'text',
        label: 'Agent 开发者角色',
        default: 'general-developer',
        required: true,
      },
      {
        name: 'max_review_loops',
        type: 'number',
        label: 'PRD Review 最大打回次数',
        default: 10,
        required: true,
      },
      {
        name: 'max_code_review_loops',
        type: 'number',
        label: 'Code Review 最大打回次数',
        default: 10,
        required: true,
      },
    ],
  },
  {
    slug: 'requirement-analysis',
    name: '需求分析流程',
    description: '需求输入 → Agent 分析 → 拆解 User Story → Review → 输出',
    category: 'analysis',
    difficulty: 'beginner',
    estimatedTime: '1-2 小时',
    parameters: [
      {
        name: 'analyst_role',
        type: 'text',
        label: 'Agent 分析师角色',
        default: 'requirement-analyst',
        required: true,
      },
      {
        name: 'max_prd_review_loops',
        type: 'number',
        label: 'PRD Review 最大打回次数',
        default: 10,
        required: true,
      },
      {
        name: 'max_story_review_loops',
        type: 'number',
        label: 'User Story Review 最大打回次数',
        default: 10,
        required: true,
      },
    ],
  },
  {
    slug: 'code-review-only',
    name: '纯 Code Review',
    description: '提交代码 → Agent Review → 人工 Review',
    category: 'review',
    difficulty: 'beginner',
    estimatedTime: '30 分钟 - 1 小时',
    parameters: [
      {
        name: 'reviewer_role',
        type: 'text',
        label: 'Agent Reviewer 角色',
        default: 'code-reviewer',
        required: true,
      },
      {
        name: 'max_review_loops',
        type: 'number',
        label: '最大打回次数',
        default: 10,
        required: true,
      },
    ],
  },
  {
    slug: 'bug-fix-flow',
    name: 'Bug 修复流程',
    description: 'Bug 描述 → Agent 分析 → 修复 → 测试验证 → Review',
    category: 'bugfix',
    difficulty: 'intermediate',
    estimatedTime: '2-6 小时',
    parameters: [
      {
        name: 'analyst_role',
        type: 'text',
        label: 'Agent 分析师角色',
        default: 'bug-analyst',
        required: true,
      },
      {
        name: 'developer_role',
        type: 'text',
        label: 'Agent 开发者角色',
        default: 'general-developer',
        required: true,
      },
      {
        name: 'tester_role',
        type: 'text',
        label: 'Agent 测试角色',
        default: 'qa-engineer',
        required: true,
      },
      {
        name: 'max_fix_loops',
        type: 'number',
        label: '最大修复重试次数',
        default: 10,
        required: true,
      },
    ],
  },
  {
    slug: 'openspec-dev-pipeline',
    name: 'Spec 驱动开发流水线',
    description: '基于 OpenSpec 的规范化开发流程：需求 → Spec 规划 → Review → 实施 → Code Review → 归档',
    category: 'development',
    difficulty: 'intermediate',
    estimatedTime: '4-8 小时',
    parameters: [
      {
        name: 'spec_role',
        type: 'text',
        label: 'Spec 架构师角色',
        default: 'spec-architect',
        required: true,
      },
      {
        name: 'developer_role',
        type: 'text',
        label: 'Agent 开发者角色',
        default: 'general-developer',
        required: true,
      },
      {
        name: 'reviewer_role',
        type: 'text',
        label: 'Agent Reviewer 角色',
        default: 'code-reviewer',
        required: true,
      },
      {
        name: 'spec_schema',
        type: 'select',
        label: 'Spec Schema',
        options: ['spec-driven', 'rapid'],
        default: 'spec-driven',
        required: true,
      },
      {
        name: 'max_spec_review_loops',
        type: 'number',
        label: 'Spec Review 最大打回次数',
        default: 10,
        required: true,
      },
      {
        name: 'max_code_review_loops',
        type: 'number',
        label: 'Code Review 最大打回次数',
        default: 10,
        required: true,
      },
    ],
  },
  {
    slug: 'openspec-init',
    name: 'OpenSpec 项目初始化',
    description: '在项目 Git 仓库中初始化 OpenSpec 目录结构，生成初始 Spec Source of Truth',
    category: 'setup',
    difficulty: 'beginner',
    estimatedTime: '30 分钟 - 1 小时',
    parameters: [
      {
        name: 'spec_role',
        type: 'text',
        label: 'Spec 架构师角色',
        default: 'spec-architect',
        required: true,
      },
    ],
  },
  {
    slug: 'openspec-dev-pipeline-v2',
    name: 'Spec 驱动开发流水线 v2（优化版）',
    description: '增加需求理解与确认环节，避免理解偏差：需求 → 理解 → 确认 → Spec 规划 → Review → 实施 → Code Review → 归档',
    category: 'development',
    difficulty: 'intermediate',
    estimatedTime: '2-4 小时',
    parameters: [
      {
        name: 'spec_role',
        type: 'text',
        label: 'Spec 架构师角色',
        default: 'spec-architect',
        required: true,
      },
      {
        name: 'developer_role',
        type: 'text',
        label: 'Agent 开发者角色',
        default: 'general-developer',
        required: true,
      },
      {
        name: 'spec_schema',
        type: 'text',
        label: 'OpenSpec Schema 版本',
        default: 'v1',
        required: false,
      },
      {
        name: 'max_spec_review_loops',
        type: 'number',
        label: 'Spec Review 最大打回次数',
        default: 3,
        required: true,
      },
      {
        name: 'max_code_review_loops',
        type: 'number',
        label: 'Code Review 最大打回次数',
        default: 3,
        required: true,
      },
    ],
  },
]

export async function runTemplatesSeed() {
  console.log('🌱 Seeding workflow templates...')

  for (const template of templates) {
    const templatePath = path.join(__dirname, 'templates', `${template.slug}.yaml`)
    const templateContent = fs.readFileSync(templatePath, 'utf-8')

    console.log(`  → Inserting template: ${template.name}`)

    await db
      .insert(workflowTemplates)
      .values({
        slug: template.slug,
        name: template.name,
        description: template.description,
        category: template.category,
        difficulty: template.difficulty,
        estimatedTime: template.estimatedTime,
        parameters: template.parameters,
        template: templateContent,
        isBuiltin: true,
      })
      .onConflictDoUpdate({
        target: workflowTemplates.slug,
        set: {
          name: template.name,
          description: template.description,
          category: template.category,
          difficulty: template.difficulty,
          estimatedTime: template.estimatedTime,
          parameters: template.parameters,
          template: templateContent,
          isBuiltin: true,
        },
      })
  }

  console.log('✅ Templates seeded successfully!')
}

// 独立执行入口
const isMain = process.argv[1]?.endsWith('seed-templates.ts') || process.argv[1]?.endsWith('seed-templates.js')
if (isMain) {
  runTemplatesSeed()
    .then(() => client.end())
    .catch(async (error) => {
      console.error('❌ Failed to seed templates:', error)
      await client.end()
      process.exit(1)
    })
}
