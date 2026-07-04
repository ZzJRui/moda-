# AI Closet Stylist MVP FRD v3

版本：v0.1  
日期：2026-07-04  
来源 PRD：[ai-closet-stylist-mvp-prd-v3.md](./ai-closet-stylist-mvp-prd-v3.md)  
开发策略：后端先行，接口验证通过后再推进前端展示

## 1. 文档目的

本文把 PRD v3 转成可开发、可验收的功能需求。第一版目标不是做完整社交产品，也不是一开始接入真实大模型，而是先跑通核心闭环：

```text
上传单品
-> 写入衣柜
-> AI/规则推荐或手动搭配
-> 三组老虎机展示
-> 保存穿搭截图
-> 我的喜欢双列展示
```

## 2. 产品范围

### 2.1 本期包含

- 手机优先响应式 Web。
- 底部四页导航：社区、我的喜欢、AI 搭配、我的衣柜。
- 底部中心上传按钮。
- 拍照或图库上传单品。
- 我的衣柜展示与搜索单品。
- AI 搭配页三组老虎机：上衣、下装、鞋子。
- AI 对话入口，第一版以文字输入为主，音频入口可先占位。
- 规则推荐穿搭，后续替换真实 AI。
- 用户手动滑动选择衣物。
- 保存穿搭组合，并生成穿搭截图。
- 我的喜欢页双列截图流。
- 穿搭详情页。
- 社区页 mock 内容。

### 2.2 本期不包含

- 登录注册。
- 多用户系统。
- 真实社区发布、评论、关注。
- App 打包和上架。
- 真实语音识别强依赖。
- 真人试穿图生成。
- 电商同款推荐。
- 复杂天气 API。

## 3. 信息架构

### FRD-IA-001 底部导航

系统在手机端展示底部导航：

```text
社区 | 喜欢 | + | 搭配 | 衣柜
```

要求：

- “社区”进入 `/community`。
- “喜欢”进入 `/favorites`。
- “+”打开上传面板，不进入独立页面。
- “搭配”进入 `/style`。
- “衣柜”进入 `/closet`。
- 默认首页建议为 `/style`。
- 当前页面对应导航项需要有选中态。

### FRD-IA-002 桌面导航

系统在宽屏展示顶部导航：

```text
AI Closet | 社区 | 我的喜欢 | AI 搭配 | 我的衣柜 | 上传
```

要求：

- 桌面端不显示底部导航。
- 上传入口可以作为顶部按钮。
- 页面内容不能因导航切换而丢失状态。

## 4. 全局上传

### FRD-UP-001 上传入口

用户点击底部中心 `+` 按钮后，系统弹出上传面板。

上传面板包含：

- 拍照上传。
- 从图库选择。
- 取消。

### FRD-UP-002 文件选择

系统支持上传以下图片格式：

- `jpg`
- `jpeg`
- `png`
- `webp`

限制：

- 单张图片大小建议不超过 8 MB。
- 后端必须校验 MIME 类型和文件扩展名。
- 文件名必须由后端生成，不能直接使用用户上传文件名。

### FRD-UP-003 上传处理

上传成功后，后端需要：

1. 保存原图。
2. 生成处理图路径。
3. 生成单品标签。
4. 写入 `clothing_items`。
5. 返回单品数据。

第一版图片处理可以先 mock 或只做基础保存。后续再接入去背景、白底图和更完整的视觉处理。

### FRD-UP-004 标签生成

第一版标签可以通过规则或手动默认值生成，但返回格式必须稳定：

```json
{
  "category": "top",
  "color": "white",
  "style": "casual"
}
```

品类必须是：

- `top`
- `bottom`
- `shoes`

### FRD-UP-005 上传状态

系统需要提供以下状态：

- 未选择图片。
- 上传中。
- 上传成功。
- 上传失败。
- 格式不支持。
- 文件过大。

## 5. 我的衣柜

### FRD-CL-001 单品列表

我的衣柜页 `/closet` 展示用户已上传的所有单品。

每个单品卡片展示：

- 单品图片。
- 单品名称。
- 品类。
- 颜色。
- 风格。

### FRD-CL-002 搜索

用户可以通过搜索框搜索单品。

搜索范围：

- 名称。
- 品类。
- 颜色。
- 风格。

示例关键词：

```text
白色
运动鞋
黑色
裙子
通勤
```

### FRD-CL-003 筛选

第一版支持按品类筛选：

- 全部。
- 上衣。
- 下装。
- 鞋子。

### FRD-CL-004 单品详情

点击单品卡片后，系统展示单品详情或详情面板。

第一版至少展示：

- 大图。
- 名称。
- 品类。
- 颜色。
- 风格。
- 创建时间。

编辑和删除可以后续扩展，但后端 API 可以先预留删除能力。

### FRD-CL-005 空状态

衣柜为空时显示：

```text
还没有衣物。点击中间的 + 上传第一件吧。
```

## 6. AI 搭配页

### FRD-ST-001 页面结构

AI 搭配页 `/style` 是核心页面。

手机端结构：

```text
页面标题 / 当前状态
上衣老虎机
下装老虎机
鞋子老虎机
推荐理由 / 当前搭配信息
保存按钮
右下角 AI 对话按钮
底部导航
```

### FRD-ST-002 三组老虎机

系统按品类加载衣柜单品：

- 上衣老虎机只展示 `top`。
- 下装老虎机只展示 `bottom`。
- 鞋子老虎机只展示 `shoes`。

每组老虎机支持：

- 横向展示。
- 手动滑动。
- 当前选中态。
- AI 推荐时自动滚动并停在目标单品。

### FRD-ST-003 手动搭配

用户可以分别滑动三组衣物，当前选中的三件单品组成一套搭配。

系统需要维护当前搭配状态：

```json
{
  "top_id": 12,
  "bottom_id": 35,
  "shoes_id": 48
}
```

### FRD-ST-004 AI 对话入口

AI 对话按钮固定在搭配页右下角，位于底部导航上方。

点击后打开对话面板。

第一版对话面板包含：

- 文字输入框。
- 发送按钮。
- 麦克风按钮。
- 关闭按钮。

麦克风按钮第一版可以只做 UI 和状态提示：

```text
语音输入后续开放。
```

如果浏览器能力允许，可尝试接入浏览器语音输入，但不能阻塞主流程。

### FRD-ST-005 AI 推荐

用户输入搭配需求后，前端调用推荐接口。

请求示例：

```json
{
  "text": "今天想去公园，帮我搭一套舒服一点的。"
}
```

返回示例：

```json
{
  "top_id": 12,
  "bottom_id": 35,
  "shoes_id": 48,
  "reason": "这套偏休闲，颜色清爽，适合公园散步。"
}
```

要求：

- 推荐结果只能引用已存在单品 ID。
- 每个品类必须返回一个单品。
- 缺少品类时返回明确错误。
- 前端拿到结果后驱动老虎机动画。

### FRD-ST-006 推荐动画

AI 推荐成功后：

1. 三组老虎机开始转动。
2. 上衣、下装、鞋子可以依次停止。
3. 最终停在推荐单品。
4. 页面展示推荐理由。

动画时长建议 1.5 到 3 秒。

需要支持减少动态效果：

- 如果用户系统设置减少动态，动画可缩短或直接跳到结果。

### FRD-ST-007 缺少单品

如果衣柜中缺少某个品类，页面需要提示：

```text
还缺少鞋子，先上传一双鞋再让 AI 搭配吧。
```

此时保存按钮不可用。

## 7. 保存穿搭

### FRD-OF-001 保存入口

AI 搭配页展示当前搭配后，用户可以点击保存。

保存来源包括：

- AI 推荐。
- 手动搭配。

### FRD-OF-002 保存内容

系统保存两类内容：

1. 穿搭组合数据。
2. 穿搭截图。

AI 推荐保存示例：

```json
{
  "top_id": 12,
  "bottom_id": 35,
  "shoes_id": 48,
  "source": "ai",
  "prompt": "今天想去公园，帮我搭一套舒服一点的。",
  "reason": "这套偏休闲，颜色清爽，适合公园散步。",
  "screenshot_path": "/uploads/favorites/outfit_001.png"
}
```

手动搭配保存示例：

```json
{
  "top_id": 12,
  "bottom_id": 35,
  "shoes_id": 48,
  "source": "manual",
  "prompt": null,
  "reason": "手动搭配",
  "screenshot_path": "/uploads/favorites/outfit_002.png"
}
```

### FRD-OF-003 截图生成

第一版由前端使用 `html2canvas` 截取穿搭区域。

要求：

- 截图区域只包含穿搭结果，不包含底部导航。
- 截图生成后上传给后端。
- 后端保存截图文件，并记录路径。

### FRD-OF-004 保存状态

系统需要展示：

- 保存中。
- 保存成功。
- 保存失败。

保存成功后，用户可以进入“我的喜欢”查看。

## 8. 我的喜欢

### FRD-FV-001 截图流

我的喜欢页 `/favorites` 第一版只展示已保存的穿搭截图。

手机端采用双列图片流：

```text
[截图卡片] [截图卡片]
[截图卡片] [截图卡片]
[截图卡片] [截图卡片]
```

卡片第一版可以只展示截图，必要时加保存时间或来源标签。

### FRD-FV-002 列表排序

截图按保存时间倒序排列，最新保存的在最前。

### FRD-FV-003 点击详情

点击截图后进入：

```text
/favorites/{id}
```

### FRD-FV-004 详情页

详情页第一版至少展示：

- 大图截图。
- 保存时间。
- 来源：AI 推荐 / 手动搭配。
- 返回按钮。

如果数据已具备，可以展示：

- 上衣。
- 下装。
- 鞋子。
- 推荐理由。

### FRD-FV-005 空状态

没有收藏时显示：

```text
还没有喜欢的穿搭。去搭配页保存第一套吧。
```

按钮跳转到 `/style`。

## 9. 社区

### FRD-CM-001 社区列表

社区页 `/community` 第一版展示 mock 内容。

每条内容包含：

- 穿搭图片。
- 标题。
- 用户昵称。
- 点赞数。
- 标签。

### FRD-CM-002 不做真实交互

第一版不要求：

- 发布。
- 评论。
- 点赞入库。
- 关注。
- 分享。

按钮可做静态或提示“后续开放”。

## 10. 数据模型

### 10.1 `clothing_items`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | 是 | 单品 ID |
| name | text | 是 | 单品名称 |
| category | text | 是 | `top` / `bottom` / `shoes` |
| color | text | 否 | 颜色标签 |
| style | text | 否 | 风格标签 |
| original_image | text | 是 | 原图路径 |
| processed_image | text | 是 | 处理图路径 |
| created_at | datetime | 是 | 创建时间 |

### 10.2 `outfits`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | 是 | 穿搭 ID |
| top_id | integer | 是 | 上衣 ID |
| bottom_id | integer | 是 | 下装 ID |
| shoes_id | integer | 是 | 鞋子 ID |
| source | text | 是 | `ai` / `manual` |
| prompt | text | 否 | 用户输入 |
| reason | text | 否 | 推荐理由 |
| screenshot_path | text | 否 | 截图路径 |
| created_at | datetime | 是 | 创建时间 |

### 10.3 `favorites`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | 是 | 收藏 ID |
| outfit_id | integer | 是 | 对应穿搭 ID |
| screenshot_path | text | 是 | 截图路径 |
| created_at | datetime | 是 | 保存时间 |

## 11. API 规格

### FRD-API-001 健康检查

```http
GET /health
```

返回：

```json
{
  "status": "ok"
}
```

### FRD-API-002 上传单品

```http
POST /api/clothes/upload
```

请求：`multipart/form-data`

字段：

- `file`: 图片文件。
- `category`: 可选。
- `color`: 可选。
- `style`: 可选。

返回：

```json
{
  "id": 1,
  "name": "白色上衣",
  "category": "top",
  "color": "white",
  "style": "casual",
  "original_image": "/uploads/original/xxx.png",
  "processed_image": "/uploads/processed/xxx.png",
  "created_at": "2026-07-04T10:00:00"
}
```

### FRD-API-003 获取单品列表

```http
GET /api/clothes?q=白色&category=top
```

返回：

```json
[
  {
    "id": 1,
    "name": "白色上衣",
    "category": "top",
    "color": "white",
    "style": "casual",
    "processed_image": "/uploads/processed/xxx.png"
  }
]
```

### FRD-API-004 推荐穿搭

```http
POST /api/recommendations/outfit
```

请求：

```json
{
  "text": "今天想去公园，帮我搭一套舒服一点的。"
}
```

返回：

```json
{
  "top_id": 1,
  "bottom_id": 2,
  "shoes_id": 3,
  "reason": "这套搭配偏休闲，适合公园散步。"
}
```

缺少品类时返回：

```json
{
  "error": "missing_category",
  "message": "还缺少鞋子，先上传一双鞋再让 AI 搭配吧。",
  "missing_categories": ["shoes"]
}
```

### FRD-API-005 保存穿搭

```http
POST /api/outfits
```

请求：

```json
{
  "top_id": 1,
  "bottom_id": 2,
  "shoes_id": 3,
  "source": "ai",
  "prompt": "今天想去公园",
  "reason": "适合公园散步"
}
```

返回：

```json
{
  "id": 10,
  "top_id": 1,
  "bottom_id": 2,
  "shoes_id": 3,
  "source": "ai",
  "prompt": "今天想去公园",
  "reason": "适合公园散步",
  "screenshot_path": null,
  "created_at": "2026-07-04T10:10:00"
}
```

### FRD-API-006 保存收藏截图

```http
POST /api/favorites
```

请求：`multipart/form-data`

字段：

- `outfit_id`: 穿搭 ID。
- `screenshot`: 截图文件。

返回：

```json
{
  "id": 5,
  "outfit_id": 10,
  "screenshot_path": "/uploads/favorites/outfit_10.png",
  "created_at": "2026-07-04T10:11:00"
}
```

### FRD-API-007 获取收藏列表

```http
GET /api/favorites
```

返回按创建时间倒序排列。

### FRD-API-008 获取收藏详情

```http
GET /api/favorites/{id}
```

返回：

```json
{
  "id": 5,
  "screenshot_path": "/uploads/favorites/outfit_10.png",
  "created_at": "2026-07-04T10:11:00",
  "outfit": {
    "id": 10,
    "source": "ai",
    "prompt": "今天想去公园",
    "reason": "适合公园散步",
    "top_id": 1,
    "bottom_id": 2,
    "shoes_id": 3
  }
}
```

## 12. 非功能需求

### FRD-NF-001 手机优先

页面从 360px 宽度开始可用。主要操作适合单手点击。

### FRD-NF-002 响应速度

第一版目标：

- 单品列表接口 1 秒内返回。
- 规则推荐接口 1 秒内返回。
- 上传和截图保存允许更久，但必须有加载状态。

### FRD-NF-003 数据安全

上传接口必须：

- 限制文件大小。
- 校验文件类型。
- 使用后端生成文件名。
- 禁止路径穿越。

### FRD-NF-004 可替换 AI

标签和推荐服务必须封装为独立模块。后续替换真实模型时，不改前端接口结构。

## 13. 验收标准

MVP 通过标准：

- 能从中心按钮上传单品。
- 单品能进入我的衣柜列表。
- 衣柜能搜索单品。
- AI 搭配页能展示三组老虎机。
- 规则推荐能返回有效的三件单品。
- AI 推荐后老虎机能停在推荐单品上。
- 用户能手动滑动三组衣物。
- 用户能保存 AI 或手动搭配。
- 我的喜欢页能双列展示截图。
- 点击截图能进入详情页。
- 社区页能展示 mock 内容。
