# 技术方案文档 (v2.1)

> 西游记 · 小朋友的睡前故事 — 技术实现说明

---

## 一、技术选型概述

本项目采用**纯静态前端方案**，无需后端服务器、数据库或构建工具，最大限度降低维护成本，利用 GitHub Pages 免费托管实现公网访问。

```
技术栈：  HTML5 + CSS3 + Vanilla JavaScript
托管：    GitHub Pages（免费，自动 CI/CD）
字体：    Google Fonts（ZCOOL XiaoWei + Noto Serif SC + Noto Sans SC）
插图：    AI 生成 PNG 图片，静态资源托管
```

---

## 二、目录结构 (v2.1 实际结构)

```
xiyouji/                      ← GitHub 仓库根目录（即 GitHub Pages 根）
├── index.html                 ← 单页应用主文件
├── css/
│   └── style.css            ← 全局样式（含主题变量、分页控件、已读标记样式）
├── js/
│   └── app.js              ← 交互逻辑（含已读管理、分页、锁定状态）
├── data/
│   ├── chapters.json        ← 章节内容数据（100章结构，前N章有内容）
│   ├── progress.json       ← 进度状态配置（currentChapter、chaptersPerDay）
│   └── style-guide.json   ← 插图生成风格指南
├── images/
│   └── ch0X-scene0X.png  ← 水墨插图（当前18张）
├── PRODUCT.md               ← 产品方案文档
├── TECH.md                  ← 技术方案文档（本文件）
├── ROADMAP.md               ← 项目进度与规划
└── CHAPTER_PLAN.md          ← 完整100章规划表
```

> **注意**：仓库根目录即 GitHub Pages 根目录，无需 `website/` 子目录。

---

## 三、架构设计

### 3.1 单页应用（SPA）模式

项目采用 **无框架 SPA** 设计，所有页面在单个 `index.html` 内通过 JS 动态切换视图：

```
视图状态：  cover（封面/目录）↔ chapter（章节阅读）
切换方式：  JS 控制 DOM 显示/隐藏 + CSS 过渡动画
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
      "title": "仙石裂开，石猴出世",
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

## 四、v2.1 新增功能技术实现

### 4.1 已读状态管理

**存储方式**：`localStorage['xyj_read']` = `[1, 2, 3, ...]`

**核心逻辑**：
```javascript
// 打开章节时标记已读
function markChapterRead(chapterId) {
  const read = JSON.parse(localStorage.getItem('xyj_read') || '[]');
  if (!read.includes(chapterId)) {
    read.push(chapterId);
    localStorage.setItem('xyj_read', JSON.stringify(read));
  }
}

// 渲染目录时检查已读状态
function isChapterRead(chapterId) {
  const read = JSON.parse(localStorage.getItem('xyj_read') || '[]');
  return read.includes(chapterId);
}
```

**视觉标记**：
- 已读章节编号背景变为 `#999` 灰色（未读为朱砂红 `#c0392b`）
- 章节按钮右侧显示 `✓ 已读` 金色标签

### 4.2 未产出章节锁定状态

**实现方式**：动态生成100章完整目录，未产出章节（`id > currentChapter`）添加锁定样式和事件拦截。

```javascript
// 锁定状态判断
const isLocked = chapter.id > currentChapter;

// 锁定章节样式
.locked-chapter {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
}

// 点击锁定章节 → 弹出提示
if (isLocked) {
  showLockToast('📖 这一回还在准备中，先看看其他回吧～');
  return;
}
```

**Toast 提示**：
- CSS 动画实现，2.2秒后自动消失
- 主题切换时样式自适应（亮色/暗色）

### 4.3 目录分页功能

**分页算法**：
```javascript
const CHAPTERS_PER_PAGE = 10;
const totalPages = Math.ceil(totalChapters / CHAPTERS_PER_PAGE);
const currentPage = Math.ceil(currentChapter / CHAPTERS_PER_PAGE);

// 计算当前页显示的章节范围
const startId = (currentPage - 1) * CHAPTERS_PER_PAGE + 1;
const endId = Math.min(startId + CHAPTERS_PER_PAGE - 1, totalChapters);
```

**分页控件**：
- `上一页` / `下一页` 按钮（首页隐藏上一页，末页隐藏下一页）
- 页码按钮（智能省略：`1 … 4 5 6 … 10`）
- 当前页码高亮为朱砂红色

**响应式**：
- 桌面：分页控件居中，单行显示
- 手机：分页控件换行，页码按钮缩小

### 4.4 智能翻页（默认打开最近已读页）

**实现逻辑**：
```javascript
function getDefaultPage() {
  const read = JSON.parse(localStorage.getItem('xyj_read') || '[]');
  if (read.length === 0) return 1;  // 首次访问，默认第1页
  
  // 找到最近已读的章节
  const lastReadId = Math.max(...read);
  return Math.ceil(lastReadId / CHAPTERS_PER_PAGE);
}
```

**效果**：
- 首次访问：默认显示第1页
- 已读第8章后刷新：自动打开第1页（第8章在第1页）
- 已读第15章后刷新：自动打开第2页（第15章在第2页）

---

## 五、关键技术实现（延续）

### 5.1 章节发布控制

通过 `progress.json` 中 `currentChapter` 控制当前已解锁章节数：

```javascript
// app.js 中的章节锁定判断
const isUnlocked = chapter.id <= currentChapter;
// 未解锁章节：禁用点击，显示 🔒 锁定图标
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
- **发布目录**：`/（根目录）`
- **访问地址**：`https://lunchwu-dev.github.io/xiyouji/`

### 6.2 部署流程

```bash
# 本地修改内容
vim data/chapters.json

# 提交并推送（自动触发 Pages 构建）
git add .
git commit -m "feat: 新增第 X-Y 章内容"
git push origin main

# GitHub Pages 约 1-2 分钟后自动更新
```

### 6.3 内容更新工作流

1. 使用 AI（WorkBuddy）生成新章节文字内容（按 v2.0 高还原度标准）
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

## 八、版本历史

| 版本 | 日期 | 核心变更 |
|------|------|---------|
| v1.0 | 2026-06-19 | 首次发布，6章压缩版 |
| v2.0 | 2026-06-19 | 100章重新设计，重写前10章（高还原度） |
| v2.1 | 2026-06-19 | 新增已读标记、锁定状态、目录分页、智能翻页 |

---

*文档版本：v2.1 | 更新日期：2026-06-19 | 作者：吴八哥*
