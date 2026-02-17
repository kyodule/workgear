# 16. 对话框统一规范

## 16.1 目标与范围

本规范用于统一 WorkGear Web 端对话框实现，重点解决：

- 嵌套弹窗点击穿透与误关闭
- 弹窗内容区滚动失效（触控板/滚轮）
- 同类场景组件用法不一致

说明：本文件不定义“对话框渐进式分层模型”，仅定义统一实现规范。文档本身可按需渐进阅读。

适用范围：

- `packages/web/src/components/ui/dialog.tsx`
- `packages/web/src/components/ui/sheet.tsx`
- `packages/web/src/components/draggable-resizable-dialog.tsx`
- 所有使用弹层的页面（Task / Flow / Artifacts / Settings）

---

## 16.2 统一组件职责

- `Dialog`：创建、编辑、确认、短表单输入。
- `Sheet`：主上下文详情容器（如 Task Detail）。
- `DraggableResizableDialog`：日志、代码/JSON 长内容查看（需拖拽和调整尺寸）。

约束：

- 同类场景必须优先复用统一组件，禁止平行造轮子。
- 长内容查看不得滥用普通 `Dialog`，统一使用 `DraggableResizableDialog`。

---

## 16.3 嵌套弹层互操作（必须遵守）

当 `Sheet` 内打开 Portal 到 `document.body` 的子弹窗时，必须满足：

1. 父层 `Sheet` 使用 `modal={false}`。
2. 父层 `SheetContent` 在 `onInteractOutside` 中对白名单来源执行 `event.preventDefault()`。
3. 子弹窗 surface 必须可交互（`pointer-events: auto`）。
4. 子弹窗遮罩点击只关闭子弹窗，不得关闭父层。

推荐标记：

- `data-draggable-dialog-surface="true"`
- `data-draggable-dialog-overlay="true"`

---

## 16.4 交互与可访问性基线

- 必须支持 `Esc` 关闭当前最上层弹窗。
- 打开弹窗时聚焦，关闭后恢复到触发源。
- 必须提供语义属性：`role="dialog"`、`aria-modal`、`aria-labelledby`。
- 拖拽句柄仅允许标题栏，内容区滚动不应触发拖拽。

---

## 16.5 滚动与日志体验

- 日志内容区必须为独立滚动容器：`flex-1 overflow-y-auto`。
- 必须支持触控板、鼠标滚轮、滚动条拖拽三种方式。
- 已完成流程（无增量日志）和运行中流程（持续追加日志）都可滚动查看历史内容。
- 自动跟随日志时，用户主动上滚后应退出自动跟随。

---

## 16.6 提交前回归清单

1. `Sheet` 内打开日志弹窗：可见、可点击、可拖拽、可滚动。
2. 点击子弹窗内部不会关闭父层。
3. 点击子弹窗遮罩只关闭子弹窗。
4. 触控板在日志区可直接上下滚动，不依赖右侧滚动条。
5. 键盘 `Esc` 与焦点恢复行为符合预期。

---

## 16.7 反模式（禁止）

- 在 `Sheet modal=true` 下再打开挂到 `body` 的复杂子弹窗。
- 仅通过提升 `z-index` 处理穿透问题。
- 用多个临时弹窗组件替代统一基础组件。

