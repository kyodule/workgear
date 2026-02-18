# Design: Human Review 节点展示关联产物

## 技术方案

### 方案概述

在前端 `flow-tab.tsx` 的 `NodeRunItem` 组件中，当 human_review 节点展开时，自动查询并展示关联产物。复用现有的 `<ArtifactPreviewCard>` 和 `<ArtifactEditorDialog>` 组件，无需后端变更。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 产物查询范围 | 查询同一 flowRunId 下所有节点的产物 | human_review 本身不生成产物，需展示上游节点产物 |
| 查询时机 | 节点展开时触发 | 避免未展开节点的无效请求，减少 API 调用 |
| 组件复用 | 复用 ArtifactPreviewCard + ArtifactEditorDialog | 保持 UI 一致性，减少代码重复 |
| 失败策略 | console.error + 静默跳过 | 产物展示是辅助功能，不应阻塞审核操作 |
| 刷新机制 | artifactRefreshKey 递增触发 useEffect | 与现有刷新机制一致 |

### 备选方案（已排除）

- **仅查询当前 nodeRunId 的产物**：排除原因：human_review 节点本身不生成产物，查询结果始终为空。需要查询上游节点或整个 flowRun 的产物。
- **在后端聚合产物数据到 node input**：排除原因：增加后端复杂度，且产物内容可能很大，不适合放入 node input。
- **新增专用 API 接口**：排除原因：现有 `GET /api/artifacts?flowRunId=` 已满足需求，无需新增接口。

---

## 数据流

### 产物加载流程

```
NodeRunItem 展开（expanded = true）
    │
    ▼
useEffect 触发（依赖: expanded, nodeRun.id, artifactRefreshKey）
    │
    ├── 条件检查: expanded === true && nodeRun.flowRunId 存在
    │
    ▼
GET /api/artifacts?nodeRunId={nodeRun.id}
    │
    ├── 返回当前节点关联产物（可能为空）
    │
    ▼
setNodeArtifacts(data)
    │
    ▼
渲染产物列表
    ├── 有产物 → 渲染 <ArtifactPreviewCard> 列表
    └── 无产物 → 不渲染产物区域
```

### 产物编辑流程

```
用户点击产物卡片的编辑按钮
    │
    ▼
onEditArtifact(artifact, content, version) 回调
    │
    ▼
FlowTab 设置 editingArtifact 状态
    │
    ▼
<ArtifactEditorDialog> 打开
    │
    ▼
用户编辑内容 → 点击保存
    │
    ▼
POST /api/artifacts/{id}/versions { content, changeSummary }
    │
    ▼
onSaved 回调 → setArtifactRefreshKey(k => k + 1)
    │
    ▼
NodeRunItem useEffect 重新触发 → 重新加载产物列表
```

---

## 文件变更清单

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/pages/kanban/task-detail/flow-tab.tsx` | MODIFY | NodeRunItem 组件增加产物加载和展示逻辑 |

### 新增文件

无

### 删除文件

无

---

## 具体代码变更

### `packages/web/src/pages/kanban/task-detail/flow-tab.tsx`

#### 变更 1: NodeRunItem 已有产物加载逻辑

当前 `NodeRunItem` 组件已经具备产物加载能力（`loadNodeArtifacts` 函数和 `nodeArtifacts` 状态），但产物展示区域仅在节点 `output` 存在时才渲染。需要调整展示条件，使 `waiting_human` 状态下也能展示产物。

当前代码中产物展示位置：

```tsx
{/* Show artifact link if present */}
{nodeArtifacts.length > 0 && (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-1">产物</p>
    <div className="space-y-1">
      {nodeArtifacts.map((artifact) => (
        <ArtifactPreviewCard ... />
      ))}
    </div>
  </div>
)}
```

此代码块已在 `expanded` 条件内，且 `loadNodeArtifacts` 在 `expanded` 时自动触发。因此当前实现已经能在 `waiting_human` 状态下展示产物。

#### 变更 2: 扩展产物查询范围

当前 `loadNodeArtifacts` 仅查询 `nodeRunId` 关联的产物。由于 human_review 节点本身不生成产物，需要额外查询同一 flowRun 下上游节点的产物。

修改 `loadNodeArtifacts` 函数：

```tsx
async function loadNodeArtifacts() {
  try {
    // 1. 查询当前节点关联的产物
    let data = await api.get(`artifacts?nodeRunId=${nodeRun.id}`).json<Artifact[]>()

    // 2. 如果当前节点无产物且是 human_review 类型，查询整个 flowRun 的产物
    if (data.length === 0 && nodeRun.nodeType === 'human_review') {
      data = await api.get(`artifacts?flowRunId=${nodeRun.flowRunId}`).json<Artifact[]>()
    }

    setNodeArtifacts(data)
  } catch (error) {
    console.error('Failed to load node artifacts:', error)
  }
}
```

#### 变更 3: 调整产物展示位置

将产物展示区域移到 `waiting_human` 状态的审核内容之前（input JSON 之前），使审核者优先看到格式化的产物内容：

```tsx
{/* Expanded content */}
{expanded && (
  <div className="border-t px-3 py-3 space-y-3">
    {/* Show output for completed nodes */}
    {nodeRun.output && ( ... )}

    {/* ★ 产物展示区域 — 移到 input 之前 */}
    {nodeArtifacts.length > 0 && (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">产物</p>
        <div className="space-y-1">
          {nodeArtifacts.map((artifact) => (
            <ArtifactPreviewCard
              key={artifact.id}
              artifact={artifact}
              onEdit={(a, content, version) => onEditArtifact(a, content, version)}
              onFullscreen={onFullscreen}
            />
          ))}
        </div>
      </div>
    )}

    {/* Show input for waiting_human nodes — 仅在无产物时显示 */}
    {nodeRun.status === 'waiting_human' && nodeRun.input && nodeArtifacts.length === 0 && (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">待审核内容</p>
        <CodeBlock ... />
      </div>
    )}

    {/* Review actions ... */}
  </div>
)}
```

关键变更点：
- 产物区域在 output 之后、input 之前渲染
- 当有产物时，隐藏 JSON 格式的 input 展示（产物已提供更好的阅读体验）
- 当无产物时，保持原有的 input JSON 展示

---

## 测试策略

- 手动验证：启动包含 agent_task → human_review 的流程 → 等待 human_review → 确认审核界面展示上游产物
- 手动验证：在审核界面展开产物卡片 → 确认 Markdown 内容正确渲染
- 手动验证：点击全屏按钮 → 确认全屏 Dialog 正常打开
- 手动验证：点击编辑按钮 → 修改内容 → 保存 → 确认产物列表自动刷新
- 手动验证：上游节点无产物时 → 确认审核界面不显示产物区域，显示原有 input JSON
- 手动验证：产物 API 请求失败时 → 确认审核操作按钮正常可用
