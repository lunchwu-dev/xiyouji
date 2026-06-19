/**
 * 西游记连载 · 儿童版
 * 首页 + 极简目录 + 章节弹窗
 * v1.3: 删除最近更新标记功能，优化锁定状态逻辑（content为空也显示锁定）
 */

(function () {
  'use strict';

  // ═─ Config ═─
  const PAGE_SIZE = 10;

  // ═─ State ═─
  const state = {
    chapters: [],
    totalChapters: 100,
    lastUpdate: '',
    theme: localStorage.getItem('xyj_theme') || 'light',
    currentChapterId: null,
    currentPage: 1,
    readChapters: loadReadChapters(),
  };

  // ═─ Read State Management ═─
  function loadReadChapters() {
    try {
      const raw = localStorage.getItem('xyj_read');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function saveReadChapters() {
    localStorage.setItem('xyj_read', JSON.stringify([...state.readChapters]));
  }

  function markChapterAsRead(chapterId) {
    if (state.readChapters.has(chapterId)) return;
    state.readChapters.add(chapterId);
    saveReadChapters();
  }

  function getDefaultPage() {
    let latestReadId = 0;
    for (const id of state.readChapters) {
      if (id > latestReadId) latestReadId = id;
    }
    if (latestReadId === 0) return 1;
    return Math.ceil(latestReadId / PAGE_SIZE);
  }

  // ═─ Utility Functions ═─
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ═─ Build Full Chapter List (with locked placeholders) ═─
  let _fullListCache = null;

  function buildFullChapterList() {
    if (_fullListCache) return _fullListCache;

    const producedIds = new Set(state.chapters.map(c => c.id));
    const fullList = [];

    for (let id = 1; id <= state.totalChapters; id++) {
      if (producedIds.has(id)) {
        const ch = state.chapters.find(c => c.id === id);
        // 检查content是否为空（null、undefined或空数组）
        const hasContent = ch.content && ch.content.length > 0;
        fullList.push({
          ...ch,
          locked: !hasContent,
          // 如果content为空，标题显示为"未更新"
          title: hasContent ? ch.title : `第${id}回（未更新）`
        });
      } else {
        fullList.push({
          id,
          title: `第${id}回（未更新）`,
          originalTitle: '',
          preview: '',
          content: [],
          images: [],
          locked: true,
          updateDate: null,
        });
      }
    }

    _fullListCache = fullList;
    return fullList;
  }

  function invalidateFullListCache() {
    _fullListCache = null;
  }

  // ═─ DOM ═─
  const $ = (sel) => document.querySelector(sel);

  const dom = {
    themeToggle:          $('#themeToggle'),
    themeIcon:            $('.theme-icon'),
    tocList:              $('#tocList'),
    tocEmpty:             $('#tocEmpty'),
    tocChapterCount:      $('#tocChapterCount'),
    tocUpdateInfo:        $('#tocUpdateInfo'),
    tocPageInfo:          $('#tocPageInfo'),
    tocPrevPage:          $('#tocPrevPage'),
    tocNextPage:          $('#tocNextPage'),
    tocPageNumbers:       $('#tocPageNumbers'),
    modal:                $('#chapterModal'),
    modalBody:            $('#modalBody'),
    modalClose:           $('#modalClose'),
    modalBackHome:        $('#modalBackHome'),
    modalChapterIndicator:$('#modalChapterIndicator'),
    modalChapterNav:      $('#modalChapterNav'),
    modalPrevChapter:     $('#modalPrevChapter'),
    modalNextChapter:     $('#modalNextChapter'),
    modalGoToc:           $('#modalGoToc'),
    prevChapterTitle:     $('#prevChapterTitle'),
    nextChapterTitle:     $('#nextChapterTitle'),
  };

  // ═─ Theme ═─
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    state.theme = theme;
    localStorage.setItem('xyj_theme', theme);
  }

  dom.themeToggle.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // ═─ Data ═─
  async function loadChapters() {
    try {
      const resp = await fetch('data/chapters.json');
      if (!resp.ok) throw new Error('load failed');
      const data = await resp.json();
      state.chapters      = data.chapters      || [];
      state.totalChapters = data.totalChapters || 100;
      state.lastUpdate    = data.lastUpdate    || '';
      invalidateFullListCache();
    } catch (e) {
      console.warn('Could not load chapters', e);
      state.chapters = [];
    }
  }

  // ═─ Render TOC with Pagination ═─
  function renderToc(page) {
    const fullList = buildFullChapterList();
    const totalPages = Math.ceil(fullList.length / PAGE_SIZE);

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    state.currentPage = page;

    const startIdx = (page - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;
    const pageChapters = fullList.slice(startIdx, endIdx);

    // Update meta bar
    dom.tocChapterCount.textContent =
      `已更新 ${state.chapters.length} 回 / 共 ${state.totalChapters} 回`;

    if (state.lastUpdate) {
      dom.tocUpdateInfo.textContent = `最近更新：${state.lastUpdate}`;
    }

    // Update pagination info
    if (dom.tocPageInfo) {
      dom.tocPageInfo.textContent = `第 ${page} 页 / 共 ${totalPages} 页`;
    }

    // Update pagination buttons
    if (dom.tocPrevPage) dom.tocPrevPage.disabled = (page <= 1);
    if (dom.tocNextPage) dom.tocNextPage.disabled = (page >= totalPages);

    // Update page number buttons
    renderPageNumbers(page, totalPages);

    if (!pageChapters || pageChapters.length === 0) {
      dom.tocList.style.display = 'none';
      if (dom.tocEmpty) dom.tocEmpty.style.display = 'block';
      return;
    }

    if (dom.tocEmpty) dom.tocEmpty.style.display = 'none';
    dom.tocList.style.display  = 'flex';

    dom.tocList.innerHTML = pageChapters.map((ch, idx) => {
      const isRead = state.readChapters.has(ch.id);

      const readBadgeHtml = isRead && !ch.locked
        ? `<div class="toc-read-badge">
             <span class="read-tag">✓ 已读</span>
           </div>`
        : '';

      const lockHtml = ch.locked
        ? `<div class="toc-lock-badge">
             <span class="lock-icon">🔒</span>
             <span class="lock-text">未更新</span>
           </div>`
        : '';

      return `
        <li
          class="toc-item${isRead && !ch.locked ? ' is-read' : ''}${ch.locked ? ' is-locked' : ''}"
          data-chapter-id="${ch.id}"
          data-locked="${ch.locked}"
          role="button"
          tabindex="0"
          aria-label="${ch.locked ? '第' + ch.id + '回（未更新锁定状态）' : '第' + ch.id + '回 ' + ch.title}"
          style="animation-delay: ${idx * 30}ms"
        >
          <span class="toc-num">${ch.id}</span>
          <span class="toc-title">${escapeHtml(ch.title)}</span>
          ${lockHtml}
          ${readBadgeHtml}
        </li>
      `;
    }).join('');

    // Click handlers for unlocked items
    dom.tocList.querySelectorAll('.toc-item:not(.is-locked)').forEach(item => {
      item.addEventListener('click', () => {
        openChapter(parseInt(item.dataset.chapterId));
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openChapter(parseInt(item.dataset.chapterId));
        }
      });
    });

    // Click handlers for locked items
    dom.tocList.querySelectorAll('.toc-item.is-locked').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        showLockToast();
      });
    });

    // Staggered fade-in
    requestAnimationFrame(() => {
      dom.tocList.querySelectorAll('.toc-item').forEach((item, i) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-8px)';
        setTimeout(() => {
          item.style.transition = `opacity 0.4s ease, transform 0.4s var(--ease-smooth)`;
          item.style.opacity = '1';
          item.style.transform = '';
        }, 40 + i * 30);
      });
    });
  }

  function renderPageNumbers(currentPage, totalPages) {
    if (!dom.tocPageNumbers) return;

    // Show max 5 page buttons
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    let html = '';
    if (startPage > 1) {
      html += `<button class="page-num-btn" data-page="1">1</button>`;
      if (startPage > 2) html += `<span class="page-ellipsis">…</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      html += `<button class="page-num-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span class="page-ellipsis">…</span>`;
      html += `<button class="page-num-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    dom.tocPageNumbers.innerHTML = html;

    // Bind click handlers
    dom.tocPageNumbers.querySelectorAll('.page-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        goToPage(page);
      });
    });
  }

  function goToPage(page) {
    renderToc(page);
    scrollTocToTop();
  }

  function goToPrevPage() {
    if (state.currentPage > 1) {
      renderToc(state.currentPage - 1);
      scrollTocToTop();
    }
  }

  function goToNextPage() {
    const totalPages = Math.ceil(buildFullChapterList().length / PAGE_SIZE);
    if (state.currentPage < totalPages) {
      renderToc(state.currentPage + 1);
      scrollTocToTop();
    }
  }

  function scrollTocToTop() {
    const tocContent = document.querySelector('.toc-content');
    if (tocContent) tocContent.scrollTop = 0;
  }

  // ═─ Lock Toast ═─
  function showLockToast() {
    let toast = document.getElementById('lockToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lockToast';
      toast.className = 'lock-toast';
      toast.textContent = '📖 这一回还未更新，先看看其他回吧～';
      document.body.appendChild(toast);
    }
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 2200);
  }

  // ═─ Open Chapter ═─
  async function openChapter(chapterId) {
    const fullList = buildFullChapterList();
    const idx = fullList.findIndex(c => c.id === chapterId);
    if (idx < 0) return;

    const chapter = fullList[idx];
    if (chapter.locked) {
      showLockToast();
      return;
    }

    state.currentChapterId = chapterId;

    // Mark as read
    markChapterAsRead(chapterId);

    const prevChapter = idx > 0                            ? fullList[idx - 1] : null;
    const nextChapter = idx < fullList.length - 1   ? fullList[idx + 1] : null;

    // ── 渲染内容 ──
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
      <div style="text-align:center; margin-bottom: 16px;">
        <span class="chapter-num-tag">第 ${chapter.id} 回</span>
        <h2 class="chapter-head">${escapeHtml(chapter.title)}</h2>
        ${originalTitleLine}
      </div>
      <div class="modal-divider"></div>
      <div class="content-block">${blocks}</div>
    `;

    // ── 更新顶部指示器 ──
    dom.modalChapterIndicator.textContent =
      `第 ${chapter.id} 回 · 共 ${state.chapters.length} 回`;

    // ── 更新底部导航按钮 ──
    if (prevChapter && !prevChapter.locked) {
      dom.modalPrevChapter.disabled = false;
      dom.prevChapterTitle.textContent = prevChapter.title;
    } else {
      dom.modalPrevChapter.disabled = true;
      dom.prevChapterTitle.textContent = '已是第一章';
    }

    if (nextChapter && !nextChapter.locked) {
      dom.modalNextChapter.disabled = false;
      dom.nextChapterTitle.textContent = nextChapter.title;
    } else {
      dom.modalNextChapter.disabled = true;
      dom.nextChapterTitle.textContent = '等待更新...';
    }

    // ── 显示弹窗 ──
    dom.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      const content = dom.modal.querySelector('.modal-content');
      if (content) content.scrollTop = 0;
      dom.modal.scrollTop = 0;
    });
  }

  function closeModal() {
    dom.modal.classList.remove('active');
    document.body.style.overflow = '';
    state.currentChapterId = null;
    setTimeout(() => { dom.modalBody.innerHTML = ''; }, 400);
  }

  // ═─ 导航事件绑定 ═─
  dom.modalClose.addEventListener('click', closeModal);

  dom.modal.addEventListener('click', (e) => {
    if (e.target === dom.modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.modal.classList.contains('active')) {
      closeModal();
      return;
    }
    if (dom.modal.classList.contains('active')) {
      if (e.key === 'ArrowLeft' && !dom.modalPrevChapter.disabled) {
        navigateToPrev();
      }
      if (e.key === 'ArrowRight' && !dom.modalNextChapter.disabled) {
        navigateToNext();
      }
    }
  });

  function navigateToPrev() {
    if (dom.modalPrevChapter.disabled) return;
    const fullList = buildFullChapterList();
    const idx = fullList.findIndex(c => c.id === state.currentChapterId);
    if (idx > 0) {
      openChapter(fullList[idx - 1].id);
    }
  }

  function navigateToNext() {
    if (dom.modalNextChapter.disabled) return;
    const fullList = buildFullChapterList();
    const idx = fullList.findIndex(c => c.id === state.currentChapterId);
    if (idx < fullList.length - 1) {
      openChapter(fullList[idx + 1].id);
    }
  }

  // ═─ TOC Navigation ═─
  if (dom.modalGoToc) {
    dom.modalGoToc.addEventListener('click', () => {
      closeModal();
      setTimeout(() => {
        renderToc(state.currentPage);
        scrollTocToTop();
      }, 400);
    });
  }

  if (dom.modalBackHome) {
    dom.modalBackHome.addEventListener('click', () => {
      closeModal();
    });
  }

  if (dom.tocPrevPage) {
    dom.tocPrevPage.addEventListener('click', goToPrevPage);
  }

  if (dom.tocNextPage) {
    dom.tocNextPage.addEventListener('click', goToNextPage);
  }

  // ═─ Init ═─
  async function init() {
    applyTheme(state.theme);
    await loadChapters();

    // Default to latest read page
    state.currentPage = getDefaultPage();
    renderToc(state.currentPage);

    // Update meta info
    if (state.lastUpdate && dom.tocUpdateInfo) {
      dom.tocUpdateInfo.textContent = `最近更新：${state.lastUpdate}`;
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
