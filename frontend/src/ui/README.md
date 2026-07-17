# Moda UI

Moda 的应用内可抽离组件层。业务代码统一从 `@moda/ui` 导入；这个目录只依赖 React 和自身文件。

## Public API

- `Button`: `primary | secondary | ghost | danger`，用意图而不是颜色描述。
- `IconButton`: 强制提供可访问名称。
- `PageHeader`: 统一标题、返回与右侧操作；导航行为由调用方传入。
- `Surface`: `plain | subtle | raised` 三种中性表面。
- `EmptyState`: 标题、说明与下一步操作。
- `Icon` 与具名图标：共享 `currentColor` SVG，禁止在 flow 中复制常用图标。

## Boundary

- 禁止导入 React Router、antd-mobile、`api/` 或 `flows/`。
- 禁止在组件 props 中暴露任意颜色、阴影或动画时长。
- 复杂业务状态留在 flow；UI 组件只接收渲染所需的语义 props。
- `architecture.test.ts` 是未来抽包的守门测试。

开发时打开 `/__ui` 查看核心状态。完整设计约束见仓库根目录 `DESIGN.md`。
