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

前端尚未初始化。下一步应进入 Phase 6：创建 `frontend/`，初始化 React + Vite + TypeScript + antd-mobile v5 + framer-motion + react-router-dom，搭建路由、API client、底部导航和页面骨架（截图用 `html2canvas`）。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Python + FastAPI + SQLAlchemy + SQLite + Pillow |
| 前端 | React 18 + TypeScript + Vite；UI 用 antd-mobile v5，动画用 framer-motion，路由用 react-router-dom，截图用 `html2canvas` |
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
AI_TIMEOUT_SECONDS=20
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

## 前端开发约定

前端尚未创建。按 todo v3 Phase 6 开始：

- 创建 `frontend/`
- 初始化 React 18 + Vite + TypeScript
- 引入 antd-mobile v5（Swiper、Popup、NavBar、Toast 等）
- 引入 framer-motion（hero animation、弹簧物理动效）
- 配置 react-router-dom，默认首页 `/style`
- 截图功能接入 `html2canvas`
- 创建 API client，连接 FastAPI 后端
- 先做四页骨架和全局导航，再接上传、衣柜、搭配、收藏闭环

> 注：UI 组件统一用 antd-mobile v5，不再单独引入 Tailwind CSS。

建议优先接真实后端 API，不要再长期依赖前端 mock，因为后端接口已经可用。

建议目录结构见 `docs/ai-closet-stylist-mvp-todo-v3.md` 第 2 节。

## 约定

- 代码注释可使用中文，保持模块顶部 docstring + 简短要点的风格。
- `.gitignore` 已忽略 `venv/`、`__pycache__/`、`app/data/`、`uploads/`、`*.db`。运行时产物不要提交。
- 需求、接口、字段争议以 PRD v3、FRD v3、todo v3 为准。
