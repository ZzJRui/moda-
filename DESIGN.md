---
name: Moda Design System
version: 0.2
status: neutral-foundation
---

# Moda design contract

Moda 目前不是品牌展示项目，而是一个让用户上传衣物、管理衣柜、完成搭配并保存结果的工具。设计顺序固定为：任务是否完成、全链路是否清楚、状态是否可恢复，最后才是视觉表达。

## Product hierarchy

1. “上传衣物”是全局唯一主 CTA，固定在底部拇指区并保持可见文字。
2. “搭配”是默认工作区；AI 助手只在搭配页出现，是次级入口。
3. 衣柜与喜欢负责查看、搜索、删除和回看，不伪装尚未实现的操作。
4. 社区在实现前只提供诚实的占位说明。

## Frame and responsive behavior

- 移动端填满视口；桌面端继续显示居中的 430px 手机框，最大高度 932px。
- 底部导航保持 `社区 | 喜欢 | 上传衣物 | 搭配 | 衣柜` 的心智模型。
- 所有页面必须处理安全区、空状态、错误恢复和长内容滚动。

## Neutral visual foundation

- 品牌未确定前只使用黑、白和中性灰。衣物照片是页面里唯一允许自然带色的内容。
- 不使用渐变、彩色状态、光晕或装饰性阴影堆叠。
- 用文字、图标、边框和位置共同表达状态，颜色不是唯一线索。
- 采用 4px 间距基线；常用值为 8、12、16、20、24、32。
- 控件、卡片、面板圆角分别为 12、16、24px；父级圆角不小于子级圆角。

## Typography

- 中文优先使用系统字体，保证 iOS、Android 和 Windows 的可读性与加载性能。
- 页面标题 20px/700，正文 14–16px，辅助信息 11–13px。
- 进度、日期和计数使用 tabular numbers。
- 中文加载文案使用省略号字符“…”而不是三个句点。

## Internal component library

公共入口是 `frontend/src/ui/index.ts`，应用通过 `@moda/ui` 导入。

- `ui` 只允许依赖 React 和自身文件；禁止依赖路由、antd-mobile、API 或业务 flow。
- 路由导航、上传逻辑、AI 状态等放在应用层，通过 props 组合基础组件。
- 公开组件以意图命名：`Button`、`IconButton`、`PageHeader`、`Surface`、`EmptyState`。
- 重复图标由 `ui/icons.tsx` 提供，图标使用 `currentColor`，不在业务页面复制 SVG。
- 开发环境使用 `/__ui` 预览组件状态；架构测试防止包边界回退。

未来抽成 npm package 时，迁移 `src/ui`、token CSS 与测试即可；不需要把 React Router 或 antd-mobile 一起带走。

## Motion

- 动效只服务于按压反馈、状态变化、空间来源和避免突变。
- 高频导航不做页面转场；按压反馈 140ms，popover 180ms，drawer 不超过 260ms。
- 上传菜单从底部 CTA 做 origin-aware scale-in（0.95 → 1）；进度只动画 `scaleX`。
- AI 面板使用可打断的弹簧和下拉关闭；释放后沿手势方向退出。
- 只动画 `transform` 与 `opacity`。禁止 `transition: all`、`scale(0)` 和无限装饰性光效。
- `prefers-reduced-motion` 下保留透明度/颜色反馈，移除位移和弹跳。

## What to learn from Vercel

- 先写约束和可验证规则，再画页面；系统边界比单张漂亮稿更能保持质量。
- 把每个状态都当成产品：empty、loading、error、dense、disabled 都需要明确下一步。
- 使用语义 HTML、键盘焦点和足够的点击目标，把可访问性作为组件 API 的一部分。
- 通过小而稳定的 token 与组件集合减少例外；新的抽象必须由真实重复证明。
- 性能属于体验：路由按需加载，昂贵依赖只在动作发生时加载。
