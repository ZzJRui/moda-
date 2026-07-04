# AI Closet Stylist MVP To Do List v3

基于 PRD：[ai-closet-stylist-mvp-prd-v3.md](./ai-closet-stylist-mvp-prd-v3.md)  
基于 FRD：[ai-closet-stylist-mvp-frd-v3.md](./ai-closet-stylist-mvp-frd-v3.md)  
开发策略：先后端，验证接口和数据闭环后，再逐步推进前端展示。

## 1. 开发原则

- 后端先行：先把数据模型、上传、推荐、保存收藏跑通。
- 接口可验证：每个后端阶段都要能用 Swagger、curl 或脚本验证。
- AI 可替换：第一版用 mock 和规则，保留真实模型替换口。
- 前端后接入：后端闭环确认后，再做手机端页面和动效。
- 先核心后扩展：社区、音频、真实去背景、真实 AI 放到后面。

## 2. 建议目录结构

```text
backend/
  app/
    main.py
    database.py
    models.py
    schemas.py
    config.py
    routers/
      health.py
      clothes.py
      recommendations.py
      outfits.py
      favorites.py
    services/
      storage_service.py
      image_service.py
      tagging_service.py
      recommendation_service.py
    tests/
      test_health.py
      test_clothes.py
      test_recommendations.py
      test_outfits_favorites.py
  requirements.txt

frontend/
  src/
    main.tsx
    App.tsx
    api/
      client.ts
      clothes.ts
      recommendations.ts
      outfits.ts
      favorites.ts
    components/
      BottomNav.tsx
      UploadAction.tsx
      SlotMachineLane.tsx
      AiChatSheet.tsx
      OutfitCapture.tsx
    pages/
      CommunityPage.tsx
      FavoritesPage.tsx
      FavoriteDetailPage.tsx
      StylePage.tsx
      ClosetPage.tsx
```

目录可以按实际项目调整，但职责建议保持清楚。

## 3. Phase 0：项目确认

- [ ] 确认使用技术栈：React 18 + TypeScript + Vite + antd-mobile v5 + framer-motion + react-router-dom + FastAPI + SQLite（截图用 `html2canvas`）。
- [ ] 确认第一版不做登录注册。
- [ ] 确认第一版图片存储在本地 `uploads/`。
- [ ] 确认第一版 AI 使用 mock / 规则。
- [ ] 确认默认首页为 `/style`。
- [ ] 确认后端 API 路径与 FRD 一致。

验收：

- 需求边界无歧义。
- 后续开发按本文顺序推进。

## 4. Phase 1：后端基础工程

### 4.1 初始化后端

- [ ] 创建 `backend/` 目录。
- [ ] 创建 Python 虚拟环境说明或依赖文件。
- [ ] 添加 FastAPI、Uvicorn、SQLAlchemy、Pydantic、python-multipart、Pillow。
- [ ] 创建 `backend/app/main.py`。
- [ ] 创建 `/health` 接口。
- [ ] 启动服务并访问 `/health`。

验收：

```text
GET /health
=> {"status":"ok"}
```

### 4.2 数据库基础

- [ ] 创建 `database.py`。
- [ ] 配置 SQLite 数据库路径。
- [ ] 创建数据库初始化方法。
- [ ] 创建 `models.py`。
- [ ] 定义 `ClothingItem`。
- [ ] 定义 `Outfit`。
- [ ] 定义 `Favorite`。
- [ ] 启动服务时自动创建表。

验收：

- 服务启动后生成 SQLite 文件。
- 表结构包含 `clothing_items`、`outfits`、`favorites`。

### 4.3 静态文件目录

- [ ] 创建 `uploads/original/`。
- [ ] 创建 `uploads/processed/`。
- [ ] 创建 `uploads/favorites/`。
- [ ] 在 FastAPI 中挂载 `/uploads` 静态目录。
- [ ] 确认静态图片路径可以被浏览器访问。

验收：

- `/uploads/...` 可以返回静态文件。

## 5. Phase 2：单品上传与衣柜接口

### 5.1 存储服务

- [ ] 创建 `storage_service.py`。
- [ ] 实现 UUID 文件名生成。
- [ ] 实现文件扩展名校验。
- [ ] 实现 MIME 类型校验。
- [ ] 实现文件大小限制。
- [ ] 实现保存原图。

验收：

- 不允许上传非图片。
- 不使用用户原始文件名作为保存文件名。

### 5.2 图片处理服务

- [ ] 创建 `image_service.py`。
- [ ] 第一版先复制原图为 processed 图。
- [ ] 预留后续 Pillow 白底处理方法。
- [ ] 预留后续 rembg 去背景入口。

验收：

- 上传后同时有 `original_image` 和 `processed_image`。

### 5.3 标签服务

- [ ] 创建 `tagging_service.py`。
- [ ] 支持前端传入 `category/color/style`。
- [ ] 如果前端未传入，使用规则或默认值。
- [ ] 校验 `category` 只能是 `top/bottom/shoes`。

验收：

- 每个单品都有合法 `category`。

### 5.4 上传接口

- [ ] 创建 `routers/clothes.py`。
- [ ] 实现 `POST /api/clothes/upload`。
- [ ] 保存文件。
- [ ] 处理图片。
- [ ] 生成标签。
- [ ] 写入数据库。
- [ ] 返回单品 JSON。

验收：

- 用 Swagger 上传图片成功。
- 数据库产生一条单品记录。
- 返回内容包含 `id/category/processed_image`。

### 5.5 衣柜列表和搜索

- [ ] 实现 `GET /api/clothes`。
- [ ] 支持 `q` 搜索。
- [ ] 支持 `category` 筛选。
- [ ] 支持 `color` 筛选。
- [ ] 支持 `style` 筛选。
- [ ] 实现 `GET /api/clothes/{id}`。
- [ ] 可选实现 `DELETE /api/clothes/{id}`。

验收：

- 能获取全部单品。
- 能按品类筛选。
- 能按关键词搜索。

## 6. Phase 3：规则推荐接口

### 6.1 推荐服务

- [ ] 创建 `recommendation_service.py`。
- [ ] 查询所有衣物。
- [ ] 按品类分组为 `top/bottom/shoes`。
- [ ] 检查缺失品类。
- [ ] 从用户文本提取简单关键词。
- [ ] 根据颜色关键词优先匹配。
- [ ] 根据风格关键词优先匹配。
- [ ] 缺少匹配时随机或按创建时间选择。
- [ ] 返回 `top_id/bottom_id/shoes_id/reason`。

关键词建议：

- 白色、黑色、蓝色。
- 休闲、舒服、公园、运动。
- 通勤、上班。
- 甜酷、约会、晚上。

验收：

- 三个品类都有单品时返回有效推荐。
- 缺少品类时返回 `missing_category`。

### 6.2 推荐接口

- [ ] 创建 `routers/recommendations.py`。
- [ ] 实现 `POST /api/recommendations/outfit`。
- [ ] 接收 `{ "text": "..." }`。
- [ ] 调用规则推荐服务。
- [ ] 返回推荐结果。

验收：

```json
{
  "top_id": 1,
  "bottom_id": 2,
  "shoes_id": 3,
  "reason": "..."
}
```

## 7. Phase 4：穿搭与收藏接口

### 7.1 穿搭保存

- [ ] 创建 `routers/outfits.py`。
- [ ] 实现 `POST /api/outfits`。
- [ ] 校验三个单品 ID 存在。
- [ ] 校验三个单品品类正确。
- [ ] 保存 `source/prompt/reason`。
- [ ] 返回穿搭记录。

验收：

- 能保存 AI 推荐穿搭。
- 能保存手动搭配穿搭。
- 不允许用鞋子 ID 冒充上衣。

### 7.2 收藏截图保存

- [ ] 创建 `routers/favorites.py`。
- [ ] 实现 `POST /api/favorites`。
- [ ] 接收 `outfit_id` 和截图文件。
- [ ] 保存截图到 `uploads/favorites/`。
- [ ] 创建 favorite 记录。
- [ ] 更新 outfit 的 `screenshot_path`。

验收：

- 截图文件保存成功。
- favorite 记录能关联 outfit。

### 7.3 收藏列表和详情

- [ ] 实现 `GET /api/favorites`。
- [ ] 按创建时间倒序返回。
- [ ] 实现 `GET /api/favorites/{id}`。
- [ ] 详情返回 favorite 和 outfit 信息。

验收：

- 我的喜欢页所需数据完整。
- 详情页能拿到截图、来源、理由、三个单品 ID。

## 8. Phase 5：后端测试与验证

- [ ] 编写健康检查测试。
- [ ] 编写上传接口测试。
- [ ] 编写衣柜搜索测试。
- [ ] 编写推荐接口测试。
- [ ] 编写缺少品类测试。
- [ ] 编写穿搭保存测试。
- [ ] 编写收藏截图保存测试。
- [ ] 准备一组本地测试图片。
- [ ] 用 Swagger 完整跑一遍后端闭环。

后端闭环验收：

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

只有这条链路通过后，再进入前端开发。

## 9. Phase 6：前端基础壳

### 9.1 初始化前端

- [ ] 创建 `frontend/`。
- [ ] 初始化 React 18 + Vite + TypeScript。
- [ ] 引入 antd-mobile v5。
- [ ] 引入 framer-motion。
- [ ] 配置 react-router-dom。
- [ ] 创建 API client。
- [ ] 配置后端 API base URL。

### 9.2 底部导航

- [ ] 创建 `BottomNav`。
- [ ] 添加社区、喜欢、搭配、衣柜四个入口。
- [ ] 添加中心 `+` 上传按钮。
- [ ] 当前路由显示选中态。
- [ ] 移动端显示底部导航。
- [ ] 桌面端隐藏底部导航。

### 9.3 页面骨架

- [ ] 创建 `CommunityPage`。
- [ ] 创建 `FavoritesPage`。
- [ ] 创建 `FavoriteDetailPage`。
- [ ] 创建 `StylePage`。
- [ ] 创建 `ClosetPage`。
- [ ] 默认路由跳转 `/style`。

验收：

- 手机宽度下能切换四个页面。
- 中心上传按钮能打开上传面板。

## 10. Phase 7：前端上传与衣柜

- [ ] 创建 `UploadAction`。
- [ ] 支持拍照入口。
- [ ] 支持图库入口。
- [ ] 调用 `POST /api/clothes/upload`。
- [ ] 上传中显示 loading。
- [ ] 上传成功后刷新衣柜数据。
- [ ] 上传失败显示错误。
- [ ] 衣柜页调用 `GET /api/clothes`。
- [ ] 实现搜索框。
- [ ] 实现品类筛选。
- [ ] 实现单品卡片。
- [ ] 实现衣柜空状态。

验收：

- 手机端可以上传图片。
- 上传后衣柜出现单品。
- 搜索能过滤结果。

## 11. Phase 8：前端 AI 搭配页

- [ ] 创建 `SlotMachineLane`。
- [ ] 按品类展示三组衣物。
- [ ] 支持手动横向滑动。
- [ ] 维护当前 `top/bottom/shoes` 选择。
- [ ] 创建 `AiChatSheet`。
- [ ] 支持文字输入。
- [ ] 麦克风按钮第一版显示占位提示。
- [ ] 调用 `POST /api/recommendations/outfit`。
- [ ] 推荐返回后触发老虎机动画。
- [ ] 动画结束后停在推荐单品。
- [ ] 显示推荐理由。
- [ ] 缺少品类时显示提示。

验收：

- 手动滑动可改变当前搭配。
- 输入文字后能得到推荐。
- 推荐后老虎机停在目标衣物。

## 12. Phase 9：前端保存穿搭与喜欢页

- [ ] 创建 `OutfitCapture` 截图区域。
- [ ] 接入 `html2canvas`。
- [ ] 点击保存时先调用 `POST /api/outfits`。
- [ ] 生成截图。
- [ ] 调用 `POST /api/favorites` 上传截图。
- [ ] 保存中显示 loading。
- [ ] 保存成功提示。
- [ ] 我的喜欢页调用 `GET /api/favorites`。
- [ ] 手机端双列展示截图。
- [ ] 点击截图进入 `/favorites/{id}`。
- [ ] 详情页调用 `GET /api/favorites/{id}`。
- [ ] 详情页展示大图和基础信息。

验收：

- AI 搭配能保存到我的喜欢。
- 手动搭配能保存到我的喜欢。
- 我的喜欢双列展示截图。
- 点击截图能进入详情。

## 13. Phase 10：社区 mock 页面

- [ ] 创建 mock 社区数据。
- [ ] 展示穿搭图片、标题、昵称、点赞数、标签。
- [ ] 按双列或信息流展示。
- [ ] 点赞、评论、分享按钮第一版不入库。

验收：

- `/community` 页面看起来完整。
- 不依赖后端社区接口。

## 14. Phase 11：响应式与桌面适配

- [ ] 添加桌面顶部导航。
- [ ] 桌面端隐藏底部导航。
- [ ] 桌面端上传入口放到顶部导航。
- [ ] 喜欢页桌面端支持更多列。
- [ ] 衣柜页桌面端支持更多列。
- [ ] 搭配页桌面端可左右分栏。
- [ ] 检查 360px、390px、768px、1024px、1440px 布局。

验收：

- 手机端体验优先。
- 桌面端不重叠、不遮挡、可正常使用。

## 15. Phase 12：最终联调与验收

- [ ] 清空数据库后重新跑完整流程。
- [ ] 上传三类单品。
- [ ] 衣柜搜索验证。
- [ ] AI 规则推荐验证。
- [ ] 手动搭配验证。
- [ ] 保存 AI 推荐穿搭。
- [ ] 保存手动搭配。
- [ ] 我的喜欢双列截图验证。
- [ ] 收藏详情页验证。
- [ ] 社区 mock 页验证。
- [ ] 手机端布局验证。
- [ ] 桌面端布局验证。

最终验收闭环：

```text
打开 /style
-> 点击 +
-> 上传上衣、下装、鞋子
-> 回到 /style
-> 输入搭配需求
-> 三组老虎机转动并停止
-> 点击保存
-> 进入 /favorites
-> 看到双列截图
-> 点击截图进入详情
```

## 16. 后续待办

这些不进第一版主线：

- [ ] 接入真实去背景。
- [ ] 接入真实多模态标签模型。
- [ ] 接入真实 AI 推荐模型。
- [ ] 接入语音转文字。
- [ ] 单品编辑和删除 UI。
- [ ] 收藏删除。
- [ ] 从喜欢页分享到社区。
- [ ] 真实社区发布和互动。
- [ ] 用户登录和多用户数据隔离。
- [ ] React Native + Expo App。
