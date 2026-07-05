# AI 数字衣柜 · AI Closet Stylist

一款手机优先的 AI 数字衣柜 Web App。上传单品 → AI 识图打标签入衣柜 → AI 或手动搭配 → 三组老虎机式展示（上衣 / 下装 / 鞋子） → 截图保存到"我的喜欢"。

> 需求文档在 `docs/`：v4 标签体系（`prd-v4`/`frd-v4`）+ v3 MVP 基线（`prd-v3`/`frd-v3`/`todo-v3`）。

## 核心闭环

```text
上传单品 → 写入衣柜 → AI/手动搭配 → 三组老虎机展示 → 保存穿搭截图 → 我的喜欢双列展示
```

第一版**不做**：登录注册、多用户、真实社区发布、真实语音识别、App 打包。
AI 推荐 & AI 识图打标签走真实 OpenAI-compatible 模型，接口结构保持可替换。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Python + FastAPI + SQLAlchemy + SQLite + Pillow（可选 rembg 抠图） |
| 前端 | React 19 + TypeScript + Vite 8 + antd-mobile v5 + framer-motion + react-router-dom v7 + html2canvas |
| 存储 | 本地 `backend/uploads/{original,processed,favorites}/` + SQLite `backend/app/data/closet.db` |
| AI | OpenAI 兼容 `/chat/completions`（推荐 & 视觉打标签共用同一套凭据） |

## 目录

```text
.
├── backend/                 FastAPI 服务，见 backend/app/
│   ├── app/{routers,services,models.py,schemas.py,main.py,config.py}
│   ├── app/tests/           pytest 端到端 + 单元测试
│   └── uploads/             运行时上传（.gitignore 已忽略）
├── frontend/                React + Vite 前端
│   └── src/
│       ├── api/             fetch 封装 + DTO + 分资源 client
│       ├── flows/           按业务闭环划分（ai-closet / ai-styling / upload / closet / favorites / shared）
│       └── utils/
├── docs/                    PRD/FRD/Todo v3-v4 + ai-env.example
└── CLAUDE.md                Claude Code 项目指令与约定
```

## 快速开始

### 1. 后端（FastAPI）

```powershell
cd backend
.\venv\Scripts\activate            # 或自建 venv：python -m venv venv
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- API: <http://127.0.0.1:8000>
- Swagger: <http://127.0.0.1:8000/docs>
- 健康检查: <http://127.0.0.1:8000/health>

运行时目录（SQLite、上传、处理、收藏截图）在 import `config.py` 时自动创建，无需手动 mkdir。

### 2. 前端（React + Vite）

```powershell
cd frontend
npm install
npm run dev                         # http://localhost:5173
```

其他脚本：`npm run build` / `npm run preview` / `npm run lint`（oxlint）。

前端 API base URL：

- 未设 `VITE_API_BASE_URL` 时，默认取 `window.location.origin`（适合同源部署或 cpolar 单隧道）；
- 本地前后端分端口开发时，在 `frontend/.env.local` 里加：
  ```env
  VITE_API_BASE_URL=http://127.0.0.1:8000
  ```

### 3. AI 环境变量

复制 `docs/ai-env.example` 到进程环境（未使用 `python-dotenv`，需在启动前 `set` / `$env:` 注入）：

```text
AI_RECOMMENDATION_PROVIDER=openai_compatible   # 或 rule 回退本地规则
AI_API_BASE_URL=https://your-provider.com/v1
AI_API_KEY=your-key
AI_MODEL=your-model
AI_TIMEOUT_SECONDS=60
AI_TAGGING_ENABLED=true                        # 上传时自动识图打标签
```

兼容旧名 `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL`，`AI_*` 优先。

## 主要 API

（细节以 Swagger 与 `docs/*-v4.md` 为准，错误体统一 `{"error", "message"}` 顶层结构。）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `POST` | `/api/clothes/upload` | 上传单品图片（v4：仅 `file`，纯 AI 打标签） |
| `GET` | `/api/clothes` | 衣柜列表，支持 `q` / `category` / `subtype` / `color_*` / `style` / `fit` / `season` / `formality` 等筛选 |
| `GET` / `DELETE` | `/api/clothes/{id}` | 单品详情 / 删除 |
| `POST` | `/api/clothes/{id}/auto-tag` | 对已存单品重新 AI 识图打标签 |
| `POST` | `/api/recommendations/outfit` | `{ "text": "..." }` → AI 推荐一套穿搭 |
| `POST` | `/api/outfits` | 保存穿搭（source: `ai` / `manual`） |
| `POST` | `/api/favorites` | 保存 `outfit_id` + 截图，回填 outfit 的 `screenshot_path` |
| `GET` | `/api/favorites` | 收藏列表，按创建时间倒序 |
| `GET` | `/api/favorites/{id}` | 收藏详情（含 outfit 摘要） |

推荐成功：`{ "top_id", "bottom_id", "shoes_id", "reason" }`。
缺品类：HTTP 422 `{ "error": "missing_category", "missing_categories": [...] }`。
AI 错误映射：`ai_not_configured` (500) / `ai_auth_failed` (401) / `ai_unavailable` (503) / `ai_invalid_response` (502)，**不静默回退**。

## 前端路由

- `/style`（默认）— AI 搭配主页，Hero 对话 + 三组老虎机
- `/closet` — 衣柜列表
- `/upload` — 上传单品（抽屉）
- `/favorites` — 我的喜欢（双列）
- `/community` — 占位
- `*` — 兜底跳 `/style`

底部导航、上传胶囊与气泡菜单在 `flows/ai-closet/ai-closet.tsx` 的 `AppShell` 内维护。

## 上传约束

对齐 `FRD-UP-002` / `FRD-NF-003`：

- 文件名使用 UUID，不用用户原始名；
- 扩展名：`jpg` / `jpeg` / `png` / `webp`；
- MIME 白名单：`image/jpeg` / `image/png` / `image/webp`；
- 单张上限 **8 MB**；
- v4：上传接口**不再接收用户手填标签**，仅 `file`，标签由 AI 视觉打标签自动生成；
- `processed_image`：rembg 抠图 + Pillow 白底 jpg；`IMAGE_PROCESSING_ENABLED=false` 时退化为原图拷贝。

## 标签体系（v4）

候选值与归一化辅助集中在 `backend/app/services/tag_constants.py`（单一来源）。所有写入路径（AI 成功 / AI 失败降级 / auto-tag）经由 `tagging_service.generate_tags()` 归一化。

- 通用：`category` / `subtype`（软枚举）/ `color_base` / `color_tone` / `pattern` / `style`（多选）/ `fit` / `season`（多选）/ `formality` / `material`
- 上衣专属：`sleeve_length` / `top_length` / `neckline`
- 下装专属：`pants_length` / `waist` / `pants_shape`
- 鞋子专属：`shoe_cut` / `shoe_type` / `sole` / `closure`

规则：单选未确定 → `"unknown"`；多选逗号分隔，未确定 → `"unknown"`；非匹配品类字段 → `None`；subtype 软枚举保留表外值。

## 测试

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest -q
```

最近验证：**73 passed, 1 skipped**（skipped 为 rembg 未装时的图片处理用例）。

自动化闭环覆盖：上传上衣 → 下装 → 鞋子 → 搜索 → 推荐 → 保存穿搭 → 上传收藏截图 → 收藏列表 → 收藏详情。

> 建议：进入大量前端联调前，用 Swagger 手动再跑一遍闭环，确认真实文件上传 / 静态图 URL / 表单体验都正常。

## 数据库迁移策略

当前无 Alembic。新增列时 dev 直接删 `backend/app/data/closet.db`，让 `init_db()` 的 `create_all` 重建；已有库不会自动加列。生产化前需引入迁移工具。

## 约定

- 代码注释可用中文，模块顶部保持 docstring + 简短要点风格；
- `.gitignore` 已忽略 `venv/` / `__pycache__/` / `app/data/` / `uploads/` / `*.db`，运行时产物不提交；
- 需求 / 接口 / 字段争议：**PRD v3 + FRD v3 + todo v3** 为基线，**标签字段以 v4 为准**；
- 分层：`routers/` 只做 HTTP；业务逻辑在 `services/`；Pydantic 模型集中在 `schemas.py`，与 SQLAlchemy 模型分离。

## 相关文档

- `docs/ai-closet-stylist-mvp-prd-v4.md` — 产品需求 v4（标签体系扩展、纯 AI 上传打标签）
- `docs/ai-closet-stylist-mvp-frd-v4.md` — 功能需求 v4
- `docs/ai-closet-stylist-mvp-prd-v3.md` / `-frd-v3.md` / `-todo-v3.md` — MVP 基线
- `docs/ai-env.example` — AI 环境变量样例
- `CLAUDE.md` — Claude Code 项目指令 / 分层约定 / 常用命令
