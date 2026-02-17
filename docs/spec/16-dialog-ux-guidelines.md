# 16. 对话框统一规范（渐进式披露）

## 16.1 目标与范围

本规范用于统一 WorkGear Web 端对话框设计与实现，解决以下问题：

- 信息一次性暴露过多，用户决策负担高
- 嵌套弹窗时出现点击穿透、误关闭、无法滚动
- 同类场景组件选型不一致，维护成本高

适用范围：

- `packages/web/src/components/ui/dialog.tsx`
- `packages/web/src/components/ui/sheet.tsx`
- `packages/web/src/components/draggable-resizable-dialog.tsx`
- 所有在 Task/Flow/Artifacts/Settings 中使用弹层的页面

---

## 16.2 渐进式披露层级

| 层级 | 形态 | 适用场景 | 不适用 |
|---|---|---|---|
| L0 | 页面内联展开（Accordion / section） | 解释性文案、次要参数、低风险信息 | 长表单提交、复杂编辑 |
| L1 | Popover / Dropdown | 轻量选择、快捷筛选、短菜单 | 长内容阅读、日志/代码预览 |
| L2 | Dialog | 创建、编辑、确认、单任务输入 | 长时阅读、可拖拽分析场景 |
| L3 | Sheet | 主上下文详情（如 Task Detail） | 叠加多个同级主流程 |
| L4 | DraggableResizableDialog | 长日志、代码/JSON 对照、需要拖拽与调整尺寸 | 简单确认框 |

选择原则：

1. 能用低层级就不用高层级。
2. 先摘要后详情，入口文案统一使用“查看详情/查看日志/展开”。
3. 一个主任务流只保留一个主容器（通常是 `Sheet`），其他信息使用子层渐进展开。

---

## 16.3 组件选型规则

- 创建/编辑：优先 `Dialog`。
- 实体详情主入口：优先 `Sheet`。
- 执行日志与调试输出：使用 `DraggableResizableDialog`。
- 同类场景禁止新建平行组件，优先复用现有基础组件。

---

## 16.4 嵌套弹层互操作（必须遵守）

当 `Sheet` 内部打开 Portal 到 `document.body` 的子弹窗（例如日志窗口）时，必须满足：

1. 父层 `Sheet` 使用 `modal={false}`。
2. 父层 `SheetContent` 使用 `onInteractOutside` 白名单，命中子弹窗节点时 `event.preventDefault()`。
3. 子弹窗可交互根节点必须可接收指针事件（如 `pointer-events: auto`）。
4. 子弹窗遮罩点击只能关闭子弹窗，不能关闭父 `Sheet`。

推荐识别标记：

- 子弹窗 surface：`data-draggable-dialog-surface="true"`
- 子弹窗 overlay：`data-draggable-dialog-overlay="true"`

---

## 16.5 滚动与日志体验

- 日志内容区必须是独立滚动容器：`flex-1 overflow-y-auto`。
- 必须支持触控板、鼠标滚轮、滚动条拖拽三种方式。
- 已完成流程（无增量日志）与运行中流程（持续追加日志）都要可滚动查看历史内容。
- 自动跟随新日志时，用户主动上滚后应退出自动跟随。

---

## 16.6 关闭与焦点规则

- `Esc` 只关闭当前最上层弹窗。
- 打开时将焦点移动到弹窗；关闭时恢复到触发按钮。
- 必须提供语义属性：`role="dialog"`、`aria-modal`、`aria-labelledby`。
- 拖拽句柄仅限标题栏，内容区滚动不应触发拖拽。

---

## 16.7 提交前回归清单

1. 在 `Sheet` 内打开日志弹窗：显示正常、可点击、可拖拽、可滚动。
2. 点击子弹窗内部不会关闭父层。
3. 点击子弹窗遮罩只关闭子弹窗。
4. 触控板在日志区可直接上下滚动，不依赖右侧滚动条。
5. 键盘 `Esc` 与焦点恢复行为符合预期。

---

## 16.8 反模式（禁止）

- 在 `Sheet modal=true` 的前提下，再打开挂载到 `body` 的复杂子弹窗。
- 仅通过提升 `z-index` 解决事件穿透问题。
- 用多个功能重复的“临时弹窗组件”替代统一基础组件。
- 在日志/代码阅读场景使用普通 `Dialog` 强行承载长内容。

