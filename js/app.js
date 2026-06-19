/**
 * 西游记连载 · 儿童版
 * 首页 + 极简目录 + 章节弹窗（含上下章导航 + 返回首页）
 */

(function () {
  'use strict';

  // ── State ──
  const state = {
    chapters: [],
    totalChapters: 100,
    lastUpdate: '',
    theme: localStorage.getItem('xyj_theme') || 'light',
    currentChapterId: null,   // 当前打开的章节 id
  };

  // ── DOM ──
  const $ = (sel) => document.querySelector(sel);

  const dom = {
    themeToggle:          $('#themeToggle'),
    themeIcon:            $('.theme-icon'),
    tocList:              $('#tocList'),
    tocEmpty:             $('#tocEmpty'),
    tocChapterCount:      $('#tocChapterCount'),
    tocUpdateInfo:        $('#tocUpdateInfo'),
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

  // ── Theme ──
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    state.theme = theme;
    localStorage.setItem('xyj_theme', theme);
  }

  dom.themeToggle.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // ── Data ──
  async function loadChapters() {
    try {
      const resp = await fetch('data/chapters.json');
      if (!resp.ok) throw new Error('load failed');
      const data = await resp.json();
      state.chapters      = data.chapters      || [];
      state.totalChapters = data.totalChapters || 100;
      state.lastUpdate    = data.lastUpdate    || '';
    } catch (e) {
      console.warn('Could not load chapters', e);
      state.chapters = [];
    }
  }

  // ── Render TOC ──
  function renderToc() {
    const chapters = state.chapters;

    // Update meta bar
    dom.tocChapterCount.textContent =
      `已更新 ${chapters.length} 回 / 共 ${state.totalChapters} 回`;

    if (state.lastUpdate) {
      dom.tocUpdateInfo.textContent = `最近更新：${state.lastUpdate}`;
    }

    if (!chapters || chapters.length === 0) {
      dom.tocList.style.display = 'none';
      dom.tocEmpty.style.display = 'block';
      return;
    }

    dom.tocEmpty.style.display = 'none';
    dom.tocList.style.display  = 'flex';

    // Find the two most recently updated chapters (last 2 in array)
    const latestIds = new Set(
      chapters.slice(-2).map(c => c.id)
    );

    dom.tocList.innerHTML = chapters.map((ch, idx) => {
      const isLatest = latestIds.has(ch.id);

      const latestBadgeHtml = isLatest
        ? `<div class="toc-latest-badge">
             <span class="latest-tag">🆕 最新更新</span>
             <span class="latest-date">${escapeHtml(state.lastUpdate)}</span>
           </div>`
        : '';

      return `
        <li
          class="toc-item${isLatest ? ' is-latest' : ''}"
          data-chapter-id="${ch.id}"
          role="button"
          tabindex="0"
          aria-label="第${ch.id}回 ${ch.title}"
          style="animation-delay: ${idx * 30}ms"
        >
          <span class="toc-num">${ch.id}</span>
          <span class="toc-title">${escapeHtml(ch.title)}</span>
          ${latestBadgeHtml}
        </li>
      `;
    }).join('');

    // Click handlers
    dom.tocList.querySelectorAll('.toc-item').forEach(item => {
      item.addEventListener('click', () => openChapter(parseInt(item.dataset.chapterId)));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openChapter(parseInt(item.dataset.chapterId));
        }
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

  // ── Chapter Detail Modal ──

  /**
   * 打开指定章节
   * @param {number} chapterId
   * @param {boolean} [scrollToTop=true] 是否滚动到顶部
   */
  function openChapter(chapterId, scrollToTop = true) {
    const idx     = state.chapters.findIndex(c => c.id === chapterId);
    const chapter = state.chapters[idx];
    if (!chapter) return;

    state.currentChapterId = chapterId;

    const prevChapter = idx > 0                            ? state.chapters[idx - 1] : null;
    const nextChapter = idx < state.chapters.length - 1   ? state.chapters[idx + 1] : null;

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
    if (prevChapter) {
      dom.modalPrevChapter.disabled = false;
      dom.prevChapterTitle.textContent = prevChapter.title;
    } else {
      dom.modalPrevChapter.disabled = true;
      dom.prevChapterTitle.textContent = '已是第一章';
    }

    if (nextChapter) {
      dom.modalNextChapter.disabled = false;
      dom.nextChapterTitle.textContent = nextChapter.title;
    } else {
      dom.modalNextChapter.disabled = true;
      dom.nextChapterTitle.textContent = '等待更新...';
    }

    // ── 显示弹窗 ──
    dom.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (scrollToTop) {
      // 弹窗内容区滚到顶部
      requestAnimationFrame(() => {
        const content = dom.modal.querySelector('.modal-content');
        if (content) content.scrollTop = 0;
        dom.modal.scrollTop = 0;
      });
    }
  }

  function closeModal() {
    dom.modal.classList.remove('active');
    document.body.style.overflow = '';
    state.currentChapterId = null;
    setTimeout(() => { dom.modalBody.innerHTML = ''; }, 400);
  }

  // ── 导航事件绑定 ──

  // 关闭弹窗（右上角 ✕）
  dom.modalClose.addEventListener('click', closeModal);

  // 点击遮罩关闭
  dom.modal.addEventListener('click', (e) => {
    if (e.target === dom.modal) closeModal();
  });

  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.modal.classList.contains('active')) {
      closeModal();
      return;
    }
    // 键盘左右键切换章节
    if (dom.modal.classList.contains('active')) {
      if (e.key === 'ArrowLeft'  && !dom.modalPrevChapter.disabled) {
        navigateToPrev();
      }
      if (e.key === 'ArrowRight' && !dom.modalNextChapter.disabled) {
        navigateToNext();
      }
    }
  });

  // 返回首页 / 目录
  dom.modalBackHome.addEventListener('click', closeModal);
  dom.modalGoToc.addEventListener('click', closeModal);

  // 上一章
  dom.modalPrevChapter.addEventListener('click', navigateToPrev);

  // 下一章
  dom.modalNextChapter.addEventListener('click', navigateToNext);

  function navigateToPrev() {
    const idx = state.chapters.findIndex(c => c.id === state.currentChapterId);
    if (idx > 0) {
      openChapter(state.chapters[idx - 1].id);
    }
  }

  function navigateToNext() {
    const idx = state.chapters.findIndex(c => c.id === state.currentChapterId);
    if (idx >= 0 && idx < state.chapters.length - 1) {
      openChapter(state.chapters[idx + 1].id);
    }
  }

  // ── Utility ──
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Init ──
  async function init() {
    applyTheme(state.theme);
    await loadChapters();
    renderToc();
  }

  init();
})();
