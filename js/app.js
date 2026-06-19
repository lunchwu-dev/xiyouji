/**
 * 西游记连载 - 儿童版
 * 核心交互逻辑：书封 → 目录 · 主题切换 · 章节加载 · 阅读进度 · 模态框
 */

(function () {
  'use strict';

  // ============ State ============
  const state = {
    chapters: [],
    totalChapters: 100,
    readChapters: JSON.parse(localStorage.getItem('xyj_read') || '[]'),
    theme: localStorage.getItem('xyj_theme') || 'light',
    lastUpdate: '',
  };

  // ============ DOM Refs ============
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    themeToggle: $('#themeToggle'),
    themeIcon: $('.theme-icon'),
    chapterGrid: $('#chapterGrid'),
    emptyState: $('#emptyState'),
    progressBar: $('#progressBar'),
    progressCount: $('#progressCount'),
    updateInfo: $('#updateInfo'),
    modal: $('#chapterModal'),
    modalBody: $('#modalBody'),
    modalClose: $('#modalClose'),
    scrollToToc: $('#scrollToToc'),
    tocPage: $('#tocPage'),
  };

  // ============ Theme ============
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    state.theme = theme;
    localStorage.setItem('xyj_theme', theme);
  }

  function toggleTheme() {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  dom.themeToggle.addEventListener('click', toggleTheme);

  // ============ Book Cover → TOC Scroll ============
  if (dom.scrollToToc && dom.tocPage) {
    dom.scrollToToc.addEventListener('click', () => {
      dom.tocPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ============ Data Loading ============
  async function loadChapters() {
    try {
      const resp = await fetch('data/chapters.json');
      if (!resp.ok) throw new Error('Failed to load');
      const data = await resp.json();
      state.chapters = data.chapters || [];
      state.totalChapters = data.totalChapters || 100;
      state.lastUpdate = data.lastUpdate || '';
    } catch (err) {
      console.warn('Could not load chapters, showing empty state', err);
      state.chapters = [];
    }
  }

  // ============ Rendering ============
  function renderChapters() {
    if (!state.chapters || state.chapters.length === 0) {
      dom.chapterGrid.innerHTML = '';
      dom.emptyState.style.display = 'block';
      updateProgress(0);
      return;
    }

    dom.emptyState.style.display = 'none';

    const cards = state.chapters.map((ch, idx) => {
      const isRead = state.readChapters.includes(ch.id);
      const imagesHtml = (ch.images && ch.images.length > 0)
        ? ch.images.slice(0, 3).map((img) =>
            `<img class="thumb" src="${escapeHtml(img)}" alt="${escapeHtml(ch.title)}插图" loading="lazy" onerror="this.style.display='none'">`
          ).join('')
        : '';

      const originalTitleHtml = ch.originalTitle
        ? `<span class="chapter-original-title">「${escapeHtml(ch.originalTitle)}」</span>`
        : '';

      return `
        <article class="chapter-card" data-chapter-id="${ch.id}" role="button" tabindex="0" aria-label="第${ch.id}回 ${ch.title}">
          <div class="chapter-number">${ch.id}</div>
          <div class="card-header">
            ${originalTitleHtml}
            <h2 class="chapter-title">${escapeHtml(ch.title)}</h2>
          </div>
          <p class="chapter-preview">${escapeHtml(ch.preview || '')}</p>
          ${imagesHtml ? `<div class="card-images">${imagesHtml}</div>` : ''}
          ${isRead ? '<span class="read-badge">✅ 已读完</span>' : ''}
        </article>
      `;
    }).join('');

    dom.chapterGrid.innerHTML = cards;

    // Staggered entrance animation
    const cardEls = dom.chapterGrid.querySelectorAll('.chapter-card');
    cardEls.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.opacity = '1';
        card.style.transform = '';
      }, 80 * i);
    });

    // Attach click handlers
    cardEls.forEach(card => {
      card.addEventListener('click', () => openChapter(parseInt(card.dataset.chapterId)));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openChapter(parseInt(card.dataset.chapterId));
        }
      });
    });
  }

  function updateProgress(readCount) {
    const total = state.totalChapters;
    const pct = total > 0 ? Math.round((readCount / total) * 100) : 0;
    dom.progressBar.style.width = pct + '%';
    dom.progressCount.textContent = `已读 ${readCount} / ${total} 回`;
  }

  function getReadCount() {
    const uniqueRead = new Set(state.readChapters.filter(id => state.chapters.some(c => c.id === id)));
    return uniqueRead.size;
  }

  // ============ Chapter Detail Modal ============
  function openChapter(chapterId) {
    const chapter = state.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    // Mark as read
    if (!state.readChapters.includes(chapterId)) {
      state.readChapters.push(chapterId);
      localStorage.setItem('xyj_read', JSON.stringify(state.readChapters));
      renderChapters();
    }

    updateProgress(getReadCount());

    // Build content blocks
    const blocks = (chapter.content || []).map(block => {
      if (block.type === 'text') {
        return `<p>${escapeHtml(block.text)}</p>`;
      }
      if (block.type === 'image') {
        return `
          <img
            class="content-image"
            src="${escapeHtml(block.src)}"
            alt="${escapeHtml(block.alt || '')}"
            loading="lazy"
            onerror="this.style.display='none'"
          >
          ${block.alt ? `<div class="image-caption">${escapeHtml(block.alt)}</div>` : ''}
        `;
      }
      return '';
    }).join('');

    const originalTitleLine = chapter.originalTitle
      ? `<span class="original-title-tag">原著回目：${escapeHtml(chapter.originalTitle)}</span>`
      : '';

    dom.modalBody.innerHTML = `
      <div style="text-align:center; margin-bottom: var(--space-sm);">
        <span class="chapter-num-tag">第 ${chapter.id} 回</span>
        <h2 class="chapter-head">${escapeHtml(chapter.title)}</h2>
        ${originalTitleLine}
      </div>
      <div class="modal-divider"></div>
      <div class="content-block">${blocks}</div>
    `;

    dom.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    dom.modalClose.focus();
    dom.modal.querySelector('.modal-content').scrollTop = 0;
  }

  function closeModal() {
    dom.modal.classList.remove('active');
    document.body.style.overflow = '';
    dom.modalBody.innerHTML = '';
  }

  dom.modalClose.addEventListener('click', closeModal);
  dom.modal.addEventListener('click', (e) => {
    if (e.target === dom.modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.modal.classList.contains('active')) {
      closeModal();
    }
  });

  // ============ Update Info ============
  function renderUpdateInfo() {
    if (state.lastUpdate && dom.updateInfo) {
      dom.updateInfo.textContent = `上次更新：${state.lastUpdate} ｜ 每晚 22:00 准时更新`;
    }
    updateProgress(getReadCount());
  }

  // ============ Utility ============
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============ Init ============
  async function init() {
    applyTheme(state.theme);
    await loadChapters();
    renderChapters();
    renderUpdateInfo();
  }

  init();
})();
