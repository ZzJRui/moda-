# AI 数字衣柜 - 产品需求文档 v4（扩展标签体系）

> 本文档是对 v3 的产品层扩展，聚焦扩展标签带来的用户与产品影响。
> 未变更部分以 v3 为准；本文档仅声明 delta。

## v4 产品影响

### 匹配更准

v3 只给 AI 模型 `category/name/color/style` 四个信号，模型无法判断"搭不搭"。
v4 提供色系、风格、季节、正式度、版型、材质等结构化标签，模型可基于：
- **色系协调**（color_tone）：浅色系配浅色系，深色配深色
- **风格一致**（style 多选）：休闲配休闲，避免运动鞋配西装
- **季节合适**（season）：夏季单品不配冬季
- **正式度对齐**（formality）：日常不配正式
- **品类连贯**：具体类目（subtype）让组合更合理

### 标签确定性与可信度

- **枚举候选**：AI 只能从候选值选，不再出现"淡蓝/浅蓝/天蓝"混乱，前端筛选与统计可靠。
- **unknown 表达不确定**：AI 看不清的字段明确标记 unknown，前端可提示"未确定"，不误导用户。
- **subtype 软枚举**：保留具体类目（如"卫衣"超出建议表也保留），兼顾灵活与规范。

## 上传 UX 变更

### v3（用户手填 + AI 补缺）

用户上传时可选填 category/color/style；填全则跳过 AI，未填则 AI 识图补缺。

### v4（纯 AI 自动打标签）

用户只需上传图片，AI 自动识别并打全标签（10 通用 + 品类专属）。

**降级策略**：
- AI 识图失败（超时/鉴权/返回非法）→ 仍入库，category 默认 top、其余标签 unknown、`tagging_status="ai_failed"`。用户可后续用 auto-tag 重打。
- AI 未开启（`AI_TAGGING_ENABLED=false`，离线/调试）→ 拒绝上传，503 `ai_tagging_disabled`。

**理由**：标签字段从 3 个增加到 19+，用户手填成本过高且易错；纯 AI 打标签配合枚举候选，既准又快。失败降级保证上传链路不被 AI 可用性绑架。

## 衣柜卡片显示

列表卡片（瘦身）显示：
- 图片、名称、品类、subtype
- color_base、color_tone、pattern
- style（多选，逗号分隔展示）、fit、season、formality

省略 material 与品类专属字段（详情页才显示），保持卡片简洁。

## 筛选 UX

v3 只支持 category 筛选。v4 扩展为：
- color_base（主色）
- style（风格，多选字段子串匹配）
- season（季节）
- formality（正式度）
- 外加 subtype / color_tone / pattern / fit

前端可做下拉单选 + 风格多选标签筛选。

## 穿搭理由质量

AI 推荐 reason 可引用结构化标签（"浅色系搭配、休闲风格、适合春秋"），比 v3 的笼统文案更可解释。规则推荐 reason 同步升级，引用 style/formality/scene。

## 与 v3 的差异

| 维度 | v3 | v4 |
| --- | --- | --- |
| 标签字段 | 3（category/color/style） | 10 通用 + 品类专属 |
| color | 单字段自由文本 | 拆为 color_base + color_tone 枚举 |
| style | 自由文本 | 枚举多选 |
| 上传输入 | file + 可选手填标签 | file only |
| 上传 AI 失败 | 降级到规则归一化 | 降级到全 unknown 入库 |
| AI 关闭时上传 | 走规则 | 拒绝 503 |
| 筛选维度 | category | category + 8 新维度 |
| 推荐信号 | 4 字段 | 19+ 字段 |

未变更：核心闭环（上传→衣柜→搭配→老虎机→收藏）、技术栈、API 路径前缀、推荐输出契约 `{top_id, bottom_id, shoes_id, reason}`。

## 后续扩展

- material 当前单选，后续可改多选（材质组合常见）
- 候选值表可按真实数据分布迭代（tag_constants.py 单一来源）
- 前端可基于 unknown 标记提示用户"补全标签"或"重新识图"
