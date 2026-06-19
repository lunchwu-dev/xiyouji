# 技术方案文档

> 西游记 · 小朋友的睡前故事 — 技术实现说明

---

## 一、技术选型概述

本项目采用**纯静态前端方案**，无需后端服务器、数据库或构建工具，最大限度降低维护成本，利用 GitHub Pages 免费托管实现公网访问。

```
技术栈：HTML5 + CSS3 + Vanilla JavaScript
托管：  GitHub Pages（免费，自动 CI/CD）
字体：  Google Fonts（ZCOOL XiaoWei + Noto Serif SC + Noto Sans SC）
插图：  AI 生成 PNG 图片，静态资源托管
```

---

## 二、目录结构

```
xiyouji/                    ← GitHub 仓库根目录
├── website/                ← 站点源码目录（GitHub Pages 根）
│   ├── index.html          ← 单页应用主文件（1,239 行）
│   ├── css/
│   │   └── style.css       ← 全局样式（900 行）
│   ├── js/
│   │   └── app.js          ← 交互逻辑（306 行）
│   ├── data/
│   │   ├── chapters.json   ← 章节内容数据（全量内容）
│   │   ├── progress.json   ← 进度状态配置
│   │   └── style-guide.json← 插图生成风格指南
│   └── images/
│       └── ch0X-scene0X.png← 水墨插图（18 张）
├── PRODUCT.md              ← 产品方案文档
├── TECH.md                 ← 技术方案文档（本文件）
├── ROADMAP.md              ← 项目进度与规划
└── overview.md             ← 项目概览（AI 生成）
```

---

## 三、架构设计

### 3.1 单页应用（SPA）模式

项目采用 **无框架 SPA** 设计，所有页面在单个 `index.html` 内通过 JS 动态切换视图：

```
视图状态：cover（封面/目录）↔ chapter（章节阅读）
切换方式：JS 控制 DOM 显示/隐藏 + CSS 过渡动画
```

### 3.2 数据驱动渲染

章节内容存储于 `chapters.json`，JS 在运行时读取并渲染到 DOM，实现**内容与展示分离**：

```javascript
// 数据格式（chapters.json）
{
  "totalChapters": 100,
  "chapters": [
    {
      "id": 1,
      "title": "石头里蹦出个小猴子",
      "content": [
        { "type": "text", "text": "..." },
        { "type": "image", "src": "images/ch01-scene01.png", "alt": "..." }
      ]
    }
  ]
}
```

### 3.3 主题系统

实现三态主题切换（亮色 / 暗色 / 系统跟随），基于 CSS 自定义属性（CSS Variables）：

```css
/* 亮色主题（默认 · 宣纸风格） */
:root {
  --bg: #f7f3ec;       /* 宣纸米黄 */
  --text: #1c1510;     /* 浓墨黑 */
  --red: #c0392b;      /* 朱砂红 */
  --gold: #b8912a;     /* 鎏金色 */
}

/* 暗色主题 */
[data-theme="dark"] {
  --bg: #1a1510;       /* 夜墨黑 */
  --text: #e8ddd0;     /* 月白色 */
}
```

主题偏好通过 `localStorage` 持久化保存。

---

## 四、设计语言系统

### 4.1 视觉风格

采用**中国传统水墨美学 × 简洁阅读体验**的设计语言：

| 元素 | 设计决策 |
|------|---------|
| 背景 | 宣纸米黄（`#f7f3ec`），营造古籍氛围 |
| 强调色 | 朱砂红（`#c0392b`）+ 鎏金（`#b8912a`） |
| 字体 | ZCOOL XiaoWei（标题）+ Noto Serif SC（正文） |
| 装饰 | SVG 水墨泼墨背景，角落纹样，竹节分割线 |
| 书封 | 仿古书封设计，上下红色封条，印章元素 |

### 4.2 动效系统

```css
/* 动效曲线 */
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);   /* 弹性过渡 */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹跳感 */

/* 时长档位 */
--dur-fast:  0.18s;   /* 即时反馈（hover 状态）*/
--dur-mid:   0.35s;   /* 页面元素过渡 */
--dur-slow:  0.55s;   /* 页面切换动画 */
```

主要动效清单：
- 封面入场：stagger 分组淡入（`animation-delay` 阶梯式）
- 章节卡片：hover 上浮 + 轻微阴影增强
- 页面切换：fade + translateY 上移
- 主题切换：CSS transition 平滑过渡（无闪烁）
- 阅读内容：scroll reveal 渐入

---

## 五、关键技术实现

### 5.1 章节发布控制

通过 `progress.json` 中 `currentChapter` 控制当前已解锁章节数。未解锁章节显示锁定态：

```javascript
// app.js 中的章节锁定判断
const isUnlocked = chapter.id <= currentChapter;
// 未解锁章节：禁用点击，显示「待更新」标签
```

### 5.2 阅读进度记忆

利用 `localStorage` 记录上次阅读章节，下次访问自动跳转：

```javascript
localStorage.setItem('lastReadChapter', chapterId);
const lastRead = localStorage.getItem('lastReadChapter');
```

### 5.3 响应式布局

采用 CSS Grid + Flexbox 双布局系统，支持以下断点：

| 断点 | 设备 | 列数 |
|------|------|------|
| < 480px | 手机竖屏 | 1 列 |
| 480-768px | 手机横屏/小平板 | 2 列 |
| 768-1024px | 平板 | 3 列 |
| > 1024px | 桌面 | 4 列 |

### 5.4 图片懒加载

通过 Intersection Observer API 实现图片懒加载，优化首屏性能：

```javascript
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.src = entry.target.dataset.src;
      imageObserver.unobserve(entry.target);
    }
  });
});
```

---

## 六、部署方案

### 6.1 GitHub Pages 配置

- **仓库**：`lunchwu-dev/xiyouji`
- **部署分支**：`main`
- **发布目录**：`website/`（在 GitHub Pages 设置中配置为 `/(root)`）
- **访问地址**：`https://lunchwu-dev.github.io/xiyouji/`

### 6.2 部署流程

```bash
# 本地修改内容
vim website/data/chapters.json

# 提交并推送（自动触发 Pages 构建）
git add .
git commit -m "feat: 新增第 X-Y 章内容"
git push origin main

# GitHub Pages 约 1-2 分钟后自动更新
```

### 6.3 内容更新工作流

1. 使用 AI（WorkBuddy）生成新章节文字内容
2. 使用 AI 图像生成工具生成水墨插图
3. 将章节数据追加至 `chapters.json`
4. 更新 `progress.json` 中 `currentChapter`
5. `git push` 发布

---

## 七、性能指标

| 指标 | 目标值 | 实现方式 |
|------|--------|---------|
| 首屏加载 | < 1.5s | 无构建工具，无框架，轻量级 |
| 动画帧率 | 60fps | CSS transform/opacity，避免 layout thrashing |
| 可访问性 | WCAG 2.1 AA | aria-label、语义化标签、颜色对比度 ≥ 4.5:1 |
| 移动端适配 | 100% | Viewport meta、rem 单位、touch 优化 |

---

*文档版本：v1.0 | 更新日期：2026-06-19*
