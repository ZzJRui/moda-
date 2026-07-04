# AI 数字衣柜 - 功能需求文档 v4（扩展标签体系）

> 本文档是对 v3 的扩展，定义单品标签体系的 v4 字段、候选值、AI 打标签契约。
> v3 作为 MVP 基线保持不变；本文档新增内容以 **v4 标签** 章节独立声明。

## v4 变更摘要

| 变更 | 说明 |
| --- | --- |
| 标签字段 | 从 v3 的 3 字段（category/color/style）扩展为通用 9 字段 + 品类专属 |
| color | 删除，替换为 `color_base`（主色） + `color_tone`（色系） |
| style | 改多选枚举（逗号分隔） |
| 上传 | 从"用户手填 + AI 补缺"改为**纯 AI 识图打标签** |
| AI 失败 | 降级入库：category 默认 top、其余标签 unknown、tagging_status=ai_failed |
| AI 关闭 | 上传拒绝：503 ai_tagging_disabled |
| 候选值 | 统一枚举，AI 不可自由发挥；subtype 除外（软枚举） |

## FRD-TAG-001：标签字段定义（v4）

### 通用字段

| 字段 | 选择 | 候选值 | 说明 |
| --- | --- | --- | --- |
| `category` | 单选 | top / bottom / shoes | FRD v3 保持不变 |
| `subtype` | 单选（软枚举） | 见候选表，可超出 | AI 可返回表外值原样保留 |
| `color_base` | 单选 | 黑色 / 白色 / 灰色 / 蓝色 / 红色 / 棕色 / 米色 | 替代旧 color |
| `color_tone` | 单选 | 浅色系 / 深色系 / 中性色 / 亮色系 / 低饱和色 | 新增 |
| `pattern` | 单选 | 纯色 / 拼色 / 条纹 / 格纹 / 印花 / 大图案 / 渐变 | 新增 |
| `style` | 多选 | 休闲 / 运动 / 通勤 / 街头 / 甜酷 / 简约 / 韩系 / 美式 | 自由文本 → 枚举多选 |
| `fit` | 单选 | 修身 / 常规 / 宽松 / oversize | 新增 |
| `season` | 多选 | 春秋 / 夏季 / 冬季 / 四季 | 新增 |
| `formality` | 单选 | 居家 / 日常 / 通勤 / 半正式 / 正式 | 新增 |
| `material` | 单选 | 棉 / 牛仔 / 针织 / 皮革 / 帆布 / 网面 / 西装面料 | 新增，后续可多选 |

### 上衣专属（category=top）

| 字段 | 候选值 |
| --- | --- |
| `sleeve_length` | 无袖 / 短袖 / 五分袖 / 长袖 |
| `top_length` | 短款 / 常规 / 长款 / 露脐 |
| `neckline` | 圆领 / V领 / 翻领 / 高领 / 连帽 / 方领 |

### 下装专属（category=bottom）

| 字段 | 候选值 |
| --- | --- |
| `pants_length` | 短裤 / 五分裤 / 九分裤 / 长裤 |
| `waist` | 低腰 / 中腰 / 高腰 |
| `pants_shape` | 修身 / 直筒 / 宽松 / 阔腿 / 束脚 / 喇叭 |

### 鞋子专属（category=shoes）

| 字段 | 候选值 |
| --- | --- |
| `shoe_cut` | 低帮 / 中帮 / 高帮 |
| `shoe_type` | 运动鞋 / 休闲鞋 / 皮鞋 / 靴子 / 凉鞋 / 板鞋 / 老爹鞋 |
| `sole` | 平底 / 厚底 / 运动缓震 |
| `closure` | 系带 / 魔术贴 / 一脚蹬 / 拉链 |

## FRD-TAG-002：标签语义规则

1. **单选字段未确定** → 存 `"unknown"`（不区分未提供与看不清）。
2. **多选字段** → 逗号分隔存储（如 `"休闲,运动"`），未确定存 `"unknown"`。
3. **非匹配品类专属字段** → 存 `None`（不适用，JSON 输出 null）。
4. **subtype 软枚举** → 候选表仅作 AI 建议，AI 返回表外值原样保留，不转 `"unknown"`。
5. **多选归一化**：去重（按首次出现顺序）、过滤候选外值、空转 `"unknown"`。

## FRD-TAG-003：AI 识图打标签

### 上传流程

```
POST /api/clothes/upload (file only)
  → AI_TAGGING_ENABLED? 否 → 503 ai_tagging_disabled
  → 调用 ai_tagging_service.tag_with_ai(image_bytes)
    → 成功：generate_tags(ai_out) → tagging_status="ai"
    → 失败 (AIClientError / AIInvalidResponseError)：
      降级 generate_tags(category=DEFAULT_CATEGORY) → tagging_status="ai_failed"
  → 写库 (201)
```

### AI 契约

- **输入**：原图 JPEG/PNG/WebP（base64 data URL）
- **输出**：JSON 对象，键为 category + ALL_TAG_FIELDS
  - category: top/bottom/shoes
  - 所有标签字段：从候选值中选，看不清填 `"unknown"`
  - 只填匹配品类的专属字段，其余给 null
  - 多选字段逗号分隔
  - subtype 可超出建议候选
- **温度**：0.2（分类任务需稳定）
- **非法输出处理**：抛 AIInvalidResponseError → 降级入库

### Auto-tag 端点

`POST /api/clothes/{id}/auto-tag`：对已存单品重新 AI 识图，更新全部标签字段。失败不降级，按错误类型返回不同 HTTP status + `error`/`message`。

## FRD-TAG-004：推荐提示词更新

### AI 推荐

单品渲染从 `id=X category=Y name=Z color=... style=...` 升级为全标签行：
```
- id=1 category=top name=白色T恤 subtype=T恤 color_base=白色 color_tone=浅色系 pattern=纯色 style=休闲 fit=常规 season=春秋 formality=日常 material=棉 sleeve_length=短袖 top_length=常规 neckline=圆领
```

系统提示词增加搭配指导：color_tone 协调、style 一致、season 合适、formality 对齐。

输出契约不变：`{top_id, bottom_id, shoes_id, reason}`。

### 规则推荐

删除旧 COLOR_KEYWORDS/STYLE_GROUPS，改用新字段匹配：
- style 多选重叠 +3
- formality 精确匹配 +2
- season 多选重叠 +2
- color_tone 匹配 +1

## FRD-TAG-005：API 变更

### 上传（破坏性变更）

```diff
- POST /api/clothes/upload  file + category/color/style (Form)
+ POST /api/clothes/upload  file only

- 200/201: { category, color, style, tagging_status: "manual"|"ai"|"ai_failed" }
+ 200/201: { category, subtype, color_base, color_tone, pattern, style, fit,
+            season, formality, material, sleeve_length, top_length, neckline,
+            pants_length, waist, pants_shape, shoe_cut, shoe_type, sole, closure,
+            tagging_status: "ai"|"ai_failed" }
+ 503: { error: "ai_tagging_disabled", message: "..." }
```

### 列表（新增筛选参数）

```diff
  GET /api/clothes?q=&category=&color=&style=
+ GET /api/clothes?q=&category=&subtype=&color_base=&color_tone=
+  &pattern=&style=&fit=&season=&formality=
```

列表响应新增字段：`subtype, color_base, color_tone, pattern, style(多选), fit, season(多选), formality`（省略 material 与品类专属字段）。

### 详情

新增全部标签字段，含 material 与品类专属字段。

## 数据迁移

开发期：删除 `backend/app/data/closet.db`，启动服务由 `init_db()` 的 `create_all` 重建。无 Alembic，无迁移脚本。

## 技术实现

候选值与归一化辅助集中在 `backend/app/services/tag_constants.py`（单一来源）。归一化瓶颈点为 `tagging_service.generate_tags()`，所有写入路径均经由此处。

详细变更见 CLAUDE.md 及 `tag_constants.py` module docstring。
