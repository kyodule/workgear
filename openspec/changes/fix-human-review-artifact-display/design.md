# Design: 修复 Human Review 产物展示的缓存与性能问题

## 技术方案

### 方案概述

修复三个前端问题：ArtifactPreviewCard 缓存不失效、ArtifactsBySourceNode 冗余 API 调用、产物加载条件过于宽泛。所有变更均在前端，不涉及后端 API 或数据库。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 缓存失效机制 | refreshKey prop + useEffect 清除 | 与现有 artifactRefreshKey 模式一致，最小侵入 |
| 节点数据传递 | 父组件传入 nodeRuns prop | 消除冗余 API 调用，符合 React 单向数据流 |
| 产物加载条件 | 按 nodeType 过滤 | 仅 human_review 和 agent_task 有产物关联 |
| refreshKey 是否必填 | 可选 prop（`refreshKey?: number`） | 不影响 artifacts-tab 等其他使用场景 |

### 备选方案（已排除）

- **使用 React Context 共享产物缓存**：排除原因：过度设计，ArtifactPreviewCard 是轻量组件，refreshKey 足够解决问题
- **在 ArtifactsBySourceNode 中缓存 nodeRuns 请求结果**：排除原因：治标不治本，父组件已有数据，应直接传递
- **使用 SWR/React Query 管理产物数据**：排除原因：引入新依赖，当前项目未使用，变更范围过大

---

## 数据流

### 修复 1: ArtifactPreviewCard 缓存刷新

```
FlowTab
  │
  ├── artifactRefreshKey 状态（编辑保存后 +1）
  │
  ▼
NodeRunItem
  │
  ├── 传递 artifactRefreshKey 到 ArtifactsBySourceNode
  │
  ▼
ArtifactsBySourceNode
  │
  ├── 传递 refreshKey 到每个 ArtifactPreviewCard
  │
  ▼
ArtifactPreviewCard（修复点）
  │
  ├── useEffect 监听 refreshKey 变化
  │   ├── 清除 content → ''
  │   ├── 清除 latestVersion → null
  │   └── 如果 expanded === true → 重新调用 loadContent()
  │
  └── 下次展开/全屏时 loadContent() 不命中缓存，获取最新数据
```

### 修复 2: ArtifactsBySourceNode 数据传递优化

```
修复前:
  FlowTab
    ├── nodeRuns 状态 ← GET /flow-runs/{id}/nodes
    │
    ▼
  NodeRunItem
    │
    ▼
  ArtifactsBySourceNode
    ├── 内部 useEffect ← GET /flow-runs/{id}/nodes  ← 冗余！
    └── nodeRunsMap 状态（异步填充，导致闪烁）

修复后:
  FlowTab
    ├── nodeRuns 状态 ← GET /flow-runs/{id}/nodes
    │
    ▼
  NodeRunItem
    ├── 传递 nodeRuns 到 ArtifactsBySourceNode
    │
    ▼
  ArtifactsBySourceNode
    ├── 直接使用 props.nodeRuns 构建分组（同步，无闪烁）
    └── 移除内部 useEffect 和 nodeRunsMap 状态
```

### 修复 3: 产物加载条件优化

```
修复前:
  NodeRunItem useEffect:
    if (expanded && nodeRun.id) → loadNodeArtifacts()
    // 所有展开的节点都触发，包括 human_input 等

修复后:
  NodeRunItem useEffect:
    if (expanded && nodeRun.id && shouldLoadArtifacts(nodeRun.nodeType)) → loadNodeArtifacts()
    // 仅 human_review 和 agent_task 触发

  function shouldLoadArtifacts(nodeType: string | null): boolean {
    return nodeType === 'human_review' || nodeType === 'agent_task'
  }
```

---

## 文件变更清单

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/components/artifact-preview-card.tsx` | MODIFY | 增加 refreshKey prop；useEffect 监听 refreshKey 清除缓存；展开状态下自动重新加载 |
| `packages/web/src/pages/kanban/task-detail/flow-tab.tsx` | MODIFY | ArtifactsBySourceNode 改为接收 nodeRuns prop，移除内部 API 调用；NodeRunItem 传递 nodeRuns；优化产物加载条件；传递 refreshKey 到 ArtifactsBySourceNode |
| `packages/web/src/pages/kanban/task-detail/__tests__/flow-tab-artifacts.test.tsx` | MODIFY | 补充缓存刷新场景测试 |

### 新增文件

无

### 删除文件

无

---

## 具体代码变更

### 变更 1: `artifact-preview-card.tsx` — 增加 refreshKey prop

```tsx
interface ArtifactPreviewCardProps {
  artifact: Artifact
  refreshKey?: number  // ← 新增
  onEdit?: (artifact: Artifact, latestContent: string, latestVersion: number) => void
  onFullscreen?: (title: string, content: string) => void
}

export function ArtifactPreviewCard({ artifact, refreshKey, onEdit, onFullscreen }: ArtifactPreviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const [latestVersion, setLatestVersion] = useState<ArtifactVersion | null>(null)

  // ← 新增: 监听 refreshKey 变化，清除缓存
  useEffect(() => {
    if (refreshKey === undefined || refreshKey === 0) return
    setContent('')
    setLatestVersion(null)
    if (expanded) {
      loadContent()
    }
  }, [refreshKey])

  // ... 其余代码不变
}
```

关键点：
- `refreshKey` 为可选 prop，默认不影响现有行为
- 跳过初始值 0 和 undefined，避免首次渲染时清除
- 展开状态下自动重新加载，折叠状态下仅清除缓存

### 变更 2: `flow-tab.tsx` — ArtifactsBySourceNode 接收 nodeRuns prop

```tsx
// 修改前: ArtifactsBySourceNode 内部请求 nodeRuns
function ArtifactsBySourceNode({
  artifacts,
  flowRunId,
  canEdit,
  onEdit,
  onFullscreen,
}: { ... }) {
  const [nodeRunsMap, setNodeRunsMap] = useState<Map<string, NodeRun>>(new Map())
  useEffect(() => {
    // 冗余 API 调用
    api.get(`flow-runs/${flowRunId}/nodes`).json<NodeRun[]>().then(...)
  }, [flowRunId])
  // ...
}

// 修改后: 接收父组件传入的 nodeRuns
function ArtifactsBySourceNode({
  artifacts,
  nodeRuns,
  canEdit,
  refreshKey,
  onEdit,
  onFullscreen,
}: {
  artifacts: Artifact[]
  nodeRuns: NodeRun[]  // ← 替代 flowRunId
  canEdit: boolean
  refreshKey?: number  // ← 新增
  onEdit: (artifact: Artifact, content: string, version: number) => void
  onFullscreen?: (title: string, content: string) => void
}) {
  // 直接从 props 构建 nodeRunsMap（同步，无闪烁）
  const nodeRunsMap = new Map(nodeRuns.map(nr => [nr.id, nr]))
  // ... 分组逻辑不变，但传递 refreshKey 给 ArtifactPreviewCard
}
```

### 变更 3: `flow-tab.tsx` — NodeRunItem 传递 nodeRuns 和优化加载条件

```tsx
// NodeRunItem 调用处增加 nodeRuns prop
<NodeRunItem
  key={node.id}
  nodeRun={node}
  nodeRuns={nodeRuns}  // ← 新增
  flowStatus={latestFlow.status}
  // ...
/>

// NodeRunItem 内部优化产物加载条件
useEffect(() => {
  const shouldLoad = nodeRun.nodeType === 'human_review' || nodeRun.nodeType === 'agent_task'
  if (expanded && nodeRun.id && shouldLoad) {
    loadNodeArtifacts()
  }
}, [expanded, nodeRun.id, artifactRefreshKey])

// ArtifactsBySourceNode 调用处传递 nodeRuns 和 refreshKey
<ArtifactsBySourceNode
  artifacts={nodeArtifacts}
  nodeRuns={nodeRuns}  // ← 替代 flowRunId
  canEdit={nodeRun.status === 'waiting_human' && nodeRun.nodeType === 'human_review'}
  refreshKey={artifactRefreshKey}  // ← 新增
  onEdit={onEditArtifact}
  onFullscreen={onFullscreen}
/>
```

---

## 测试策略

### 自动化测试

- 单元测试：`packages/web/src/pages/kanban/task-detail/__tests__/flow-tab-artifacts.test.tsx`
  - 新增：编辑产物后 refreshKey 递增，验证 ArtifactPreviewCard 接收到 refreshKey
  - 新增：ArtifactsBySourceNode 不再发起 flow-runs nodes API 请求
  - 新增：human_input 类型节点展开时不触发产物加载 API
  - 保持：现有 6 个测试用例不变

### 手动验证

- 审核界面编辑产物 → 保存 → 确认卡片内容自动刷新（不再显示旧内容）
- 审核界面展开 human_review 节点 → 确认分组标题与产物卡片同时出现（无闪烁）
- 展开 human_input 类型节点 → 确认浏览器 Network 面板无 artifacts API 请求
- 展开 agent_task 类型节点 → 确认仅发起 nodeRunId 查询（无 flowRunId 查询）
- artifacts-tab 中的产物卡片 → 确认行为不受影响（未传 refreshKey）
