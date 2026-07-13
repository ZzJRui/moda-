# Moda 设计规范（DESIGN.md）

> 本文档是 Moda 前端视觉与组件的**单一事实来源**。所有 UI 改动（人写或 AI 写）先对照本文档；
> 规范与代码冲突时，以本文档为准并修代码。组件与令牌的活体展示在 `/design` 路由。
>
> 方法论参考 Vercel Geist（vercel.com/design.md）：令牌语义化、间距节奏、克制的动效、可访问性优先。

## 0. 品牌基调

黑白极简 + 单一品牌色（活力橙红）。颜色只用来表达**状态与层级**，不做装饰。
高对比、留白充足、动效克制。

## 1. 设计令牌（Design Tokens）

唯一定义处：`src/index.css` 的 `:root`。组件一律 `var(--xxx)` 引用，**禁止新增硬编码色值**
（唯一例外：SVG 插画的 attribute 色，`var()` 在 SVG attribute 中无效；图标必须用 `currentColor`，不受此例外）。

### 1.1 颜色语义

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--brand` | `#ff5c33` | 主操作按钮、FAB、激活态 Tab、用户气泡 |
| `--brand-press` | `#e64a24` | 品牌色按压态 |
| `--brand-bg` | `rgba(255,92,51,.1)` | 品牌色浅背景（标签底、高亮块） |
| `--ink` / `--ink-strong` | `#111` / `#000` | 页面标题 / 强调标题 |
| `--text` | `#333` | 正文 |
| `--text-2` | `#666` | 次要文字 |
| `--text-3` | `#999` | 辅助说明、占位 |
| `--text-disabled` | `#bbb` | 禁用态文字 |
| `--bg` / `--bg-subtle` / `--bg-muted` | `#fff / #fafafa / #f5f5f5` | 页面底 / 卡片底 / 输入框与图标钮底 |
| `--divider` / `--border` / `--border-strong` | `#f0f0f0 / #eee / #ddd` | 分隔线 / 常规描边 / 强描边 |
| `--danger` / `--success` / `--warning` | 对齐 antd-mobile 色板 | 语义色，单一来源 |

规则：**不允许只靠颜色传达状态**（错误必须带文案/图标，激活 Tab 同时有填色+标签）。

### 1.2 间距节奏（4px 基）

刻度：`4 / 8 / 12 / 16 / 24 / 32 / 40`，对应令牌 `--space-1..7`。

节奏口诀（源自 Geist）：**组内 8px，组间 16px，区块间 32~40px**。

- 页面左右安全边距：16px（`--space-4`）
- 卡片内边距：12~16px；标签/胶囊内边距：纵 4 横 12
- 禁止出现 10px / 14px / 18px 这类脱离刻度的间距（既有代码逐步清理）

### 1.3 圆角语义

| 令牌 | 值 | 场景 |
| --- | --- | --- |
| `--radius-s` | 8px | 小控件：输入框、小标签、缩略图 |
| `--radius-m` | 12px | 卡片、信息块、气泡菜单 |
| `--radius-l` | 16px | 弹层、抽屉、大图容器 |
| `--radius-pill` | 999px | 胶囊按钮、搜索框、头像 |

### 1.4 阴影层级

- `--shadow-1`：悬浮卡片 hover
- `--shadow-2`：气泡菜单、悬浮胶囊
- `--shadow-3`：模态、FAB

### 1.5 动效分级

| 令牌 | 值 | 场景 |
| --- | --- | --- |
| （无动画） | 0ms | 纯数据刷新——0ms 往往是最顺滑的 |
| `--dur-fast` | 160ms | 按压、hover、聚焦等状态变化 |
| `--dur-base` | 250ms | 弹层、气泡出入 |
| `--dur-modal` | 300ms | 模态、全屏抽屉 |

弹簧动效走 framer-motion（`whileTap` / layoutId morph）。
**所有动效必须尊重 `prefers-reduced-motion`**（全局工具类已处理，新增 keyframes 需自行降级）。

### 1.6 字号阶梯

| 用途 | 字号/字重 |
| --- | --- |
| 页面标题（NavBar/Header） | 20px / 700，letter-spacing -0.3px |
| 卡片标题 / 详情名称 | 16~18px / 600 |
| 正文 | 14px / 400 |
| 次要说明 | 13px / 400 |
| 辅助信息（日期、caption） | 12px |
| 标签文字 | 11~12px |
| 底部导航标签 | 10px / 600 |

## 2. 组件库（`src/ui/`）

Moda 内部组件库，**业务代码（`src/flows/`）不得直接 `import 'antd-mobile'`**，
一律从 `src/ui` 引入。antd-mobile 是内部实现细节（包装收编策略）：
复杂件（Dialog、Swiper、ActionSheet、PullToRefresh…）内部由 antd-mobile 提供，
未来可替换实现而业务不动。

```text
src/ui/
  icons/       # Icon 组件 + 图标注册表（唯一图标来源）
  Toast        # 自研 showToast（antd-mobile 命令式 Toast 在 React 19 失效，禁用 Toast.show）
  PageHeader   # 返回键 + 居中标题 + 右侧插槽
  IconButton   # 40x40 图标按钮
  AsyncState   # loading / error+重试 / empty 三态统一容器
  antd.ts      # antd-mobile 收编再导出（业务只从这里拿）
  index.ts     # barrel
```

### 2.1 规则

1. **新组件先查 `/design` 展示页**，已有的不许重复造；新增组件必须同步登记到展示页。
2. 图标一律 `<Icon name="..." />`，`currentColor` 填色，颜色由父级 `color` 控制；
   尺寸档位 16 / 20 / 24；默认 strokeWidth 1.8。禁止在 flow 里手写 `<svg>` 图标
   （页面级插画除外，如衣柜空态拼贴画）。
3. 提示一律 `showToast(msg)`；禁止 `Toast.show`（React 19 下静默失效）。
4. 加载/错误/空三态一律 `<AsyncState>`，不要每页手写。
5. 页头一律 `<PageHeader>`（收藏"搭配详情"视图除外，见冻结区）。

### 2.2 样式载体：CSS Modules

- 每个组件/页面一个 `xxx.module.css`，类名 camelCase；颜色、间距、圆角全部 `var(--xxx)`。
- 交互伪类（`:hover/:active/:focus-within`）直接写在 module 里，并自带
  `prefers-reduced-motion` 降级；旧全局工具类（`.pressable` 等）已随迁移完成从 index.css 删除。
- 动态值（运行时计算的高度、进度、framer-motion 的 motion value）才允许 inline style。
- html2canvas 离屏截图镜像（ai-styling 保存穿搭）刻意用硬编码色值，属截图产物，不受令牌约束。
- 巨型 `S` 样式对象已全部清除，禁止在新代码中出现。

## 3. 文案

- 中文文案；按钮用动词开头（"开始上传""查看衣柜"）。
- 错误提示 = 发生了什么 + 怎么办（"缺少鞋子，先上传再让 AI 搭配吧"）。
- 后端 `ApiError.message` 可直接展示给用户。

## 4. 可访问性

- 对比度 ≥ WCAG AA（4.5:1）；`--text-3` 以下的灰不用于关键信息。
- 所有可交互元素保留 `:focus-visible` 焦点环（全局已配）。
- 纯图标按钮必须有 `aria-label`。
- 不用纯颜色传状态。

## 5. 冻结区（不许视觉优化）

- **收藏页"搭配详情"视图**（`flows/favorites` 中 `selectedDetail` 分支，页头标题为"搭配详情"）：
  只允许结构性重构（抽组件、换样式载体），像素观感必须保持不变。

## 6. 迁移状态

**全部完成（2026-07-13）。** 五个 flow 均为 CSS Modules + `src/ui` 收编，
`Toast.show` 与全局工具类已清零，`HeroDialog.tsx`（死代码）已删除。
favorites 的"搭配详情"视图按冻结区要求样式数值 1:1 保留（`frozen*` 类名标记）。
