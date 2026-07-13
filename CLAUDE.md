# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## 项目概览

AI 数字衣柜 Web App，手机优先响应式。核心闭环：

```text
上传单品 -> 写入衣柜 -> AI/手动搭配 -> 三组老虎机展示 -> 保存穿搭截图 -> 我的喜欢双列展示
```

需求来源是 `docs/` 下的文档。标签体系以 v4 为准（扩展字段），其余以 v3 为准：

- `docs/ai-closet-stylist-mvp-prd-v4.md` / `docs/ai-closet-stylist-mvp-frd-v4.md`：扩展标签体系（v4，标签字段、候选值、上传纯 AI 打标签）。
- `docs/ai-closet-stylist-mvp-prd-v3.md` / `docs/ai-closet-stylist-mvp-frd-v3.md` / `docs/ai-closet-stylist-mvp-todo-v3.md`：MVP 基线（信息架构、页面、分阶段清单）。标签字段已被 v4 取代，其余仍有效。

第一版刻意不做：登录注册、多用户、真实社区发布、强依赖真实语音识别、App 打包。AI 推荐与 AI 识图打标签走真实 OpenAI-compatible 模型，接口结构保持可替换。

## 当前状态

当前后端已完成 todo v3 的 Phase 1 到 Phase 5 主要内容，并通过自动化后端闭环测试：

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest -q
```

最近验证结果：`73 passed, 1 skipped`（skipped 为 rembg 未装时的图片处理用例）。

后端自动化闭环已覆盖：

```text
上传上衣
-> 上传下装
-> 上传鞋子
-> 搜索衣柜
-> 请求推荐
-> 保存穿搭
-> 上传收藏截图
-> 获取收藏列表
-> 获取收藏详情
```

注意：todo v3 Phase 5 还要求用 Swagger 或 curl 手动完整跑一遍后端闭环。自动化测试已通过，但在进入大量前端联调前，建议再做一次手动验收，确认真实文件上传、静态图片 URL、Swagger 表单体验正常。

前端已初始化在 `frontend/`，React 19 + Vite 8 + TypeScript + antd-mobile v5 + framer-motion + react-router-dom v7 + html2canvas 已装齐；路由、API client、底部导航、四个主页面骨架均已就绪。当前进入前端联调阶段，接真实后端接口，不再依赖 mock。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Python + FastAPI + SQLAlchemy + SQLite + Pillow |
| 前端 | React 19 + TypeScript + Vite 8；UI 用 antd-mobile v5，动画用 framer-motion，路由用 react-router-dom v7，截图用 `html2canvas` |
| 存储 | 本地 `backend/uploads/`，分 `original` / `processed` / `favorites` 子目录 |

## 后端命令

后端在 `backend/`，使用 `backend/venv/` 虚拟环境。

```powershell
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

访问地址：

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- 健康检查: `http://127.0.0.1:8000/health`

运行时目录在 `config.py` import 时自动创建，无需手动 mkdir：

- SQLite: `backend/app/data/closet.db`
- 上传目录: `backend/uploads/original/`
- 处理图目录: `backend/uploads/processed/`
- 收藏截图目录: `backend/uploads/favorites/`

## 后端结构

### 配置与启动

- `backend/app/config.py` 集中路径常量与可调参数：`UPLOAD_DIR`、`DB_URL`、`MAX_UPLOAD_BYTES=8MB`、`ALLOWED_IMAGE_EXTS`、`CORS_ORIGINS`。
- `backend/app/main.py` 用 `lifespan` 在启动时 `ensure_runtime_dirs()` + `init_db()`，挂载 `/uploads` 静态目录，并注册开发期 CORS。
- 新增 router 一律在 `main.py` 用 `app.include_router(...)` 注册；路由文件内用 `APIRouter(prefix="/api/...")` 加前缀。健康检查 `/health` 是例外。

### 数据库

- `backend/app/database.py` 使用 SQLAlchemy `declarative_base` + 每请求 `get_db()` 依赖。无 Alembic：新增列靠 dev 删 `backend/app/data/closet.db` 后 `init_db()` 的 `create_all` 重建，已有库不会自动加列。
- SQLite 使用 `check_same_thread=False` 适配 FastAPI 多线程。
- `backend/app/models.py` 定义 `ClothingItem`、`Outfit`、`Favorite`。`ClothingItem` 标签字段对齐 FRD v4（通用 9 + 品类专属），候选值见 `tag_constants.py`。
- 外键约束本阶段未加，当前通过接口层校验防止非法引用。改动前先确认是否需要补。
- `category` 只能是 `top` / `bottom` / `shoes`；`Outfit.source` 只能是 `ai` / `manual`。

### 分层约定

- `routers/` 只做 HTTP 层。
- 业务逻辑放在 `services/`：`storage_service`、`image_service`、`tag_constants`（候选值单一来源）、`tagging_service`（归一化瓶颈点）、`ai_tagging_service`、`recommendation_service`、`ai_recommendation_service`。
- Pydantic 请求/响应模型集中在 `schemas.py`，与 SQLAlchemy 模型分离。

## 后端 API

接口路径与入参出参见 PRD/FRD v3，标签字段与上传流程以 v4 为准：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `POST` | `/api/clothes/upload` | 上传单品图片（v4：仅 `file`，纯 AI 打标签） |
| `GET` | `/api/clothes` | 衣柜列表，支持 `q` / `category` / `subtype` / `color_base` / `color_tone` / `pattern` / `style` / `fit` / `season` / `formality` |
| `GET` | `/api/clothes/{id}` | 单品详情（含全部标签字段） |
| `DELETE` | `/api/clothes/{id}` | 删除单品及本地图片 |
| `POST` | `/api/clothes/{id}/auto-tag` | 对已存单品重新 AI 识图打标签（更新全部字段） |
| `POST` | `/api/recommendations/outfit` | 根据 `{ "text": "..." }` 推荐穿搭 |
| `POST` | `/api/outfits` | 保存穿搭组合 |
| `POST` | `/api/favorites` | 保存 `outfit_id` + 截图文件，并回填 outfit 的 `screenshot_path` |
| `GET` | `/api/favorites` | 收藏截图列表，按创建时间倒序 |
| `GET` | `/api/favorites/{id}` | 收藏详情，包含 outfit 摘要 |

推荐接口成功返回：

```json
{
  "top_id": 1,
  "bottom_id": 2,
  "shoes_id": 3,
  "reason": "..."
}
```

缺少品类时返回顶层字段，不使用 `detail` 包裹：

```json
{
  "error": "missing_category",
  "message": "还缺少鞋子，先上传再让 AI 搭配吧。",
  "missing_categories": ["shoes"]
}
```

### AI 推荐

推荐接口默认走真实 AI（OpenAI-compatible `/chat/completions`），不再走规则。
`AI_RECOMMENDATION_PROVIDER=rule` 时回退本地规则推荐（调试/离线）。
AI 调用失败时返回明确错误，**不静默回退规则**。错误体均为顶层 `error` / `message`：

| error | HTTP | 触发 |
| --- | --- | --- |
| `missing_category` | 422 | 缺品类（调用模型前检查，不调 AI） |
| `ai_not_configured` | 500 | provider=openai_compatible 但 base_url/key/model 缺失 |
| `ai_auth_failed` | 401 | 模型接口 401/403 |
| `ai_unavailable` | 503 | 超时/网络错误/其他非 2xx |
| `ai_invalid_response` | 502 | 非 JSON / 缺键 / ID 不存在 / 品类不匹配 / reason 空 |

ENV（示例见 `docs/ai-env.example`，未引入 `python-dotenv`，需在进程环境设置）：

```text
AI_RECOMMENDATION_PROVIDER=openai_compatible   # 或 rule
AI_API_BASE_URL=https://your-provider.com/v1
AI_API_KEY=your-key
AI_MODEL=your-model
AI_TIMEOUT_SECONDS=60
# 兼容旧名：OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL（AI_* 优先）
```

分层：`services/ai_client.py`（纯传输，httpx 同步）→ `services/ai_recommendation_service.py`（prompt 构造 + JSON 解析校验）→ `routers/recommendations.py`（按 provider 分发 + 错误映射）。规则实现保留在 `services/recommendation_service.py`，已升级到按新标签字段（style/formality/season/color_tone）评分。

### 标签体系（v4）

候选值与归一化辅助集中在 `services/tag_constants.py`（单一来源，所有模块从这里取，不各自硬编码）。字段定义：

- 通用：`category` / `subtype`(软枚举) / `color_base` / `color_tone` / `pattern` / `style`(多选) / `fit` / `season`(多选) / `formality` / `material`
- 上衣专属：`sleeve_length` / `top_length` / `neckline`
- 下装专属：`pants_length` / `waist` / `pants_shape`
- 鞋子专属：`shoe_cut` / `shoe_type` / `sole` / `closure`

规则：单选未确定存 `"unknown"`；多选逗号分隔存储，未确定存 `"unknown"`；非匹配品类专属字段存 `None`；subtype 软枚举保留表外值。详见 `tag_constants.py` docstring 与 `docs/ai-closet-stylist-mvp-frd-v4.md`。

归一化瓶颈点：`tagging_service.generate_tags(category=None, **fields) -> TagOutput`，所有写入路径（上传 AI 成功 / 上传 AI 失败降级 / auto-tag）均经由此处。

### AI 识图打标签（v4）

上传流程改为**纯 AI 自动打标签**，用户不再手填：

```text
POST /api/clothes/upload (file only)
  → AI_TAGGING_ENABLED? 否 → 503 ai_tagging_disabled
  → ai_tagging_service.tag_with_ai(image_bytes)
    → 成功：generate_tags(ai_out) → tagging_status="ai"
    → 失败 (AIClientError / AIInvalidResponseError)：
      降级 generate_tags() → category 默认 top、其余 unknown → tagging_status="ai_failed"
```

上传错误体（顶层 `error` / `message`）：

| error | HTTP | 触发 |
| --- | --- | --- |
| `ai_tagging_disabled` | 503 | `AI_TAGGING_ENABLED=false` 时上传 |

（上传的 AI 失败走降级入库，不返回错误码；auto-tag 端点失败沿用推荐的错误映射 `ai_not_configured` / `ai_auth_failed` / `ai_unavailable` / `ai_invalid_response`。）

分层：`services/ai_client.py`（纯传输）→ `services/ai_tagging_service.py`（vision 多模态 prompt 构造 + JSON 解析，候选清单从 `tag_constants` 动态生成）→ `routers/clothes.py`（上传/降级/auto-tag）。

ENV 复用 AI 推荐的 `AI_*` 凭据，独立开关 `AI_TAGGING_ENABLED`（默认 `true`）：

```text
AI_TAGGING_ENABLED=true   # 上传时自动 AI 识图打标签；false 时上传拒绝 503
```

## 上传约束

对照 `FRD-UP-002` 和 `FRD-NF-003`：

- 文件名用 UUID 生成，不使用用户原始文件名作为保存路径。
- 支持扩展名：`jpg` / `jpeg` / `png` / `webp`。
- 校验 MIME：`image/jpeg` / `image/png` / `image/webp`。
- 单张文件大小上限 8MB。
- v4：上传**不再接收用户手填标签**（旧 `category`/`color`/`style` 表单字段已移除），仅收 `file`，标签由 AI 识图自动生成。
- `processed_image`：rembg 抠图 + Pillow 白底 jpg（`IMAGE_PROCESSING_ENABLED=false` 时退化为原图拷贝）。

可选加固项：当前主要依赖扩展名和 MIME 校验，还没有用 Pillow 打开图片做内容嗅探。公开试用前建议补上。

## 测试

测试目录已建立：`backend/app/tests/`。

运行全部后端测试：

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest -q
```

主要覆盖：

- `/health`
- 单品上传成功与失败
- 衣柜列表、搜索、筛选、详情、删除
- 推荐成功与缺品类错误
- 保存 AI/手动穿搭
- 收藏截图保存、列表倒序、详情
- 后端端到端闭环

当前有非阻塞 warning：

- `datetime.utcnow()` 后续会弃用，可改为 timezone-aware UTC。
- Starlette `TestClient` 对当前 `httpx` 组合有弃用提示。

## 前端命令

前端在 `frontend/`，使用 npm 与本地 `node_modules/`。

```powershell
cd frontend
npm install         # 首次或依赖变更后
npm run dev         # 开发服务器
npm run build       # tsc -b && vite build
npm run preview     # 预览构建产物
npm run lint        # oxlint
```

开发服务器默认监听 `http://localhost:5173`。

## 前端结构

入口与路由：

- `src/main.tsx` → `src/App.tsx` → `src/flows/ai-closet/ai-closet.tsx`（`AppShell`）
- 路由由 `BrowserRouter` + `Routes` 定义在 `ai-closet.tsx`，四条主路径 + 兜底：
  - `/style`（默认首页，AI 搭配主页）
  - `/closet`（衣柜列表）
  - `/upload`（上传单品）
  - `/favorites`（收藏列表）
  - `/community`（占位）
  - `*` 兜底 `Navigate to /style`
- 底部导航、上传胶囊 (`UploadCapsule`) 与气泡菜单 (`UploadBubbleMenu`) 均在 `AppShell` 内维护。

按 flow 组织 UI，不使用 `pages/components` 二分：

```text
src/
  api/                     # HTTP 层与错误归一化
    client.ts              # fetch 封装，BASE_URL 从 VITE_API_BASE_URL/window.origin 推断
    errors.ts              # ApiError + parseApiError（顶层 error/message）
    dto.ts                 # 后端 schema TS 类型镜像
    clothes.ts             # 上传/列表/详情/删除/auto-tag，含 XHR 进度封装
    outfits.ts             # 保存穿搭
    recommendations.ts     # AI 推荐
    favorites.ts           # 收藏截图上传与列表
  ui/                      # Moda 内部组件库（唯一 UI 入口，见 DESIGN.md）
    icons/Icon.tsx         # 图标注册表 + Icon 组件（currentColor）
    toast.ts               # showToast（替代 React 19 下失效的 Toast.show）
    AsyncState / PageHeader / IconButton
    antd.ts                # antd-mobile 收编再导出层（不导出 Toast）
    index.ts               # barrel，flows 只从这里 import
  flows/
    ai-closet/             # AppShell、底部导航、上传胶囊 / 气泡菜单
    ai-styling/            # 首页 StylingHome + Hero + 三组老虎机 + 对话
    upload/                # 上传抽屉
    closet/                # 衣柜列表（CSS Modules 迁移样板）
    favorites/             # 收藏双列（"搭配详情"视图视觉冻结）
    design/                # /design 组件库活体展示页
    shared/                # image-url / mappers / types，跨 flow 复用
  utils/device.ts          # 设备信息
  assets/  public/         # 静态资源
```

## 前端开发约定

**设计规范单一来源是 `frontend/DESIGN.md`**（令牌语义、间距节奏、组件库规则），活体展示页在 `/design` 路由。UI 改动先对照 DESIGN.md，新组件必须登记到展示页。

- **组件库 `src/ui/`（包装收编策略）**：业务代码（`src/flows/`）不得直接 `import 'antd-mobile'`，一律从 `src/ui` 引入（`ui/antd.ts` 是收编再导出层）。图标一律 `<Icon name="..."/>`（`ui/icons/Icon.tsx` 注册表），禁止在 flow 里手写 `<svg>` 图标（页面级插画除外）。
- **Toast**：一律用 `ui/toast.ts` 的 `showToast()`。antd-mobile 命令式 `Toast.show` 在 React 19 下静默失效，已禁止（`ui/antd.ts` 刻意不导出 Toast）。
- **样式载体**：新代码/迁移用 CSS Modules（`xxx.module.css`，类名 camelCase，颜色间距圆角全走 `var(--xxx)` 令牌）。`closet` flow 是迁移样板；其余 flow 的巨型 `S` inline-style 对象是待迁移遗留，禁止新增。迁移状态表见 DESIGN.md §6。
- **三态**：loading/error/empty 一律 `<AsyncState>`；页头一律 `<PageHeader>`。
- **视觉冻结区**：收藏页"搭配详情"视图（favorites 的 `selectedDetail` 分支）只许结构重构，观感不许变。
- UI 组件底座为 antd-mobile v5（Swiper、Popup、NavBar、SafeArea 等，经 `ui/antd.ts` 收编），不再引入 Tailwind CSS。
- 动画走 framer-motion（Hero、弹簧过渡）。
- API 层：所有请求经 `api/client.ts` 的 `request<T>()`；错误统一抛 `ApiError`，UI 层用 `err.message` 直接 Toast 即可。
- BASE URL：开发默认 `window.location.origin`（同源）或 `VITE_API_BASE_URL`。若前后端跨端口开发，需要在 `.env.local` 里配置 `VITE_API_BASE_URL=http://127.0.0.1:8000`，或在 `vite.config.ts` 加 `server.proxy`（当前 vite.config 未设代理）。
- 静态图片 URL：后端返回的 `original_image_path` / `processed_image_path` 是相对路径，前端在 `flows/shared/image-url.ts` 里拼接 `getApiBaseUrl()` 展示。
- 优先接真实后端，不再依赖前端 mock；后端接口已完全可用。

### 设计令牌与动效（`src/index.css`）

- 颜色/圆角/阴影/动效时长统一定义在 `src/index.css` 的 `:root` 设计令牌里，组件内联样式引用 `var(--xxx)`，**不再新增硬编码色值**（SVG 插画/图标的 attribute 色除外，var() 在 SVG 属性里无效）。
- 品牌主色是活力橙红 `--brand`(#ff5c33)（另有 `--brand-press/--brand-bg`），用于主操作按钮、FAB、激活态 Tab 图标、用户气泡等；标题/正文仍用黑 `--ink`(#111)/`--ink-strong`(#000)。文字灰阶 `--text/--text-2/--text-3/--text-disabled`，背景 `--bg/--bg-subtle/--bg-muted`，边框 `--divider/--border/--border-strong`，语义色 `--danger/--success/--warning`（对齐 antd-mobile 色板）。
- antd-mobile 主题已通过 `:root:root { --adm-color-primary: var(--brand); ... }` 全局对齐品牌色，`color="primary"` 的组件自动跟随，不要再为单个组件改色。
- 底部 Tab 图标用 `stroke="currentColor"`/`fill="currentColor"` 画，激活态由父级 `color: var(--brand)` 统一填色（SVG 属性里不能直接写 var()，currentColor 是桥梁），激活时经 framer-motion 弹跳一次（见 `NavTab`）。
- 交互反馈用 index.css 里的工具类，不要在组件里重复写 transition：
  - `.pressable`：小控件按压缩放（按钮、tab、图标）；
  - `.card-press`：卡片按压 + hover 阴影；
  - `.focus-ring`：输入框/搜索框聚焦描边；
  - `.empty-slot-hover`：虚线空槽 hover。
  - framer-motion 元素用 `whileTap={{ scale: 0.9x }}` 代替。
  - 已带 `prefers-reduced-motion` 降级，新动效也要遵守。
- 开发种子数据：`backend/seed_demo.py` 从仓库根 `衣橱/` 样例图向数据库种入三品类单品（可重复执行）。前后端跨端口联调时前端 `.env.local` 配 `VITE_API_BASE_URL`，后端启动时用 `CORS_ORIGINS` 环境变量放行对应端口。

## 约定

- 代码注释可使用中文，保持模块顶部 docstring + 简短要点的风格。
- `.gitignore` 已忽略 `venv/`、`__pycache__/`、`app/data/`、`uploads/`、`*.db`。运行时产物不要提交。
- 需求、接口、字段争议以 PRD v3、FRD v3、todo v3 为准。
