# AI Closet Stylist MVP

AI 智能穿搭助手 — 移动端 H5 原型应用

## 技术栈

- React 19 + TypeScript 6 + Vite 8
- Ant Design Mobile 5 (antd-mobile)
- React Router 7
- Tailwind CSS (可选)

## 快速启动

### 前提条件

- Node.js >= 18（推荐 20+）
- npm >= 9

### 安装 & 运行



### 生产构建



## 项目结构



## 页面导航

底部 TabBar 4个Tab + 中心上传按钮：
- 搭配（默认首页 /style）
- 喜欢（/favorites）
- + 上传（中心按钮，触发 ActionSheet）
- 搭配方案（预留）
- 衣柜（/closet）

## 核心交互

- **老虎机动画**：三组 Swiper 交错停止（200ms / 800ms / 1400ms）+ CSS 发光效果
- **AI 对话面板**：底部 Popup 上滑展开
- **下拉刷新**：收藏/衣柜列表支持 PullToRefresh

## Mock 数据

所有衣物/搭配/收藏数据均为前端 Mock，图片使用 picsum.photos 占位图。
接入真实后端时替换 src/flows/shared/mock-data.ts 和 API 调用即可。
