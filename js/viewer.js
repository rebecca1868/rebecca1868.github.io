// 圖片瀏覽器：頁面上有 data-viewer 的圖片，點擊後開啟。
// - 圖片從原位置放大進入、關閉時縮回（支援的瀏覽器使用 View Transitions，其他淡入淡出）
// - 左右滑動切換（原生捲動吸附）、方向鍵、底部縮圖
// - 點兩下或按放大鏡放大細看，放大時可以拖曳移動
// - 觸控往下拉關閉，Esc 關閉
(() => {
  const sources = [...document.querySelectorAll('img[data-viewer]')];
  if (!sources.length) return;

  // 建立瀏覽器的結構
  const v = document.createElement('div');
  v.className = 'viewer';
  v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '圖片瀏覽');
  v.innerHTML = `
    <div class="v-bar"><span class="v-count"></span>
      <div class="v-tools"><button class="v-zoom" aria-label="放大">＋</button><button class="v-close" aria-label="關閉">✕</button></div></div>
    <div class="v-track"></div>
    <div class="v-caption"></div>
    <div class="v-thumbs"></div>`;
  document.body.appendChild(v);
  const track = v.querySelector('.v-track'), cap = v.querySelector('.v-caption');
  const count = v.querySelector('.v-count'), thumbs = v.querySelector('.v-thumbs');
  const zoomBtn = v.querySelector('.v-zoom');

  sources.forEach((src, n) => {
    const slide = document.createElement('div'); slide.className = 'v-slide';
    const img = document.createElement('img'); img.alt = src.alt; img.dataset.src = src.dataset.viewer || src.src;
    slide.appendChild(img); track.appendChild(slide);
    const t = document.createElement('button'); t.setAttribute('aria-label', `第 ${n + 1} 張`);
    t.innerHTML = `<img src="${src.currentSrc || src.src}" alt="">`;
    t.addEventListener('click', () => go(n));
    thumbs.appendChild(t);
    src.style.cursor = 'zoom-in';
    src.addEventListener('click', e => { e.preventDefault(); open(n); });
  });
  const slides = [...track.children], slideImgs = slides.map(s => s.firstChild), thumbBtns = [...thumbs.children];

  let index = 0, isOpen = false;
  // 每張圖都縮放到填滿可用空間（保持比例），解析度不同的圖顯示起來一樣大
  const fit = im => {
    if (!im.naturalWidth || !im.parentElement.clientWidth) return;
    const s = im.parentElement, r = Math.min(s.clientWidth / im.naturalWidth, s.clientHeight / im.naturalHeight);
    im.style.width = Math.floor(im.naturalWidth * r) + 'px'; im.style.height = Math.floor(im.naturalHeight * r) + 'px';
  };
  slideImgs.forEach(im => im.addEventListener('load', () => fit(im)));
  addEventListener('resize', () => slideImgs.forEach(fit));
  const load = n => { const im = slideImgs[n]; if (im && !im.src) im.src = im.dataset.src; else if (im) fit(im); };
  const captionOf = n => {
    const fig = sources[n].closest('figure'), fc = fig && fig.querySelector('figcaption');
    if (!fc) return sources[n].alt;
    const c = fc.cloneNode(true); c.querySelectorAll('.hint').forEach(h => h.remove());
    return c.innerHTML;
  };
  const update = n => {
    index = n;
    slides.forEach((s, i) => s.classList.toggle('current', i === n));
    thumbBtns.forEach((b, i) => b.classList.toggle('on', i === n));
    thumbBtns[n].scrollIntoView({ inline: 'center', block: 'nearest' });
    count.textContent = `${n + 1} / ${slides.length}`;
    cap.innerHTML = captionOf(n);
    [n - 1, n, n + 1].forEach(load);
  };
  const go = (n, smooth = true) => {
    n = Math.max(0, Math.min(slides.length - 1, n));
    unzoom();
    track.scrollTo({ left: slides[n].offsetLeft - (track.clientWidth - slides[n].clientWidth) / 2, behavior: smooth ? 'smooth' : 'instant' });
    update(n);
  };

  // 捲動停下後，判斷目前在第幾張
  let st;
  track.addEventListener('scroll', () => {
    clearTimeout(st);
    st = setTimeout(() => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0, d = Infinity;
      slides.forEach((s, i) => { const c = s.offsetLeft + s.clientWidth / 2; if (Math.abs(c - mid) < d) { d = Math.abs(c - mid); best = i; } });
      if (best !== index) { unzoom(); update(best); }
    }, 80);
  }, { passive: true });

  // 開啟／關閉：用 View Transitions 讓圖片從原位置放大、縮回
  const clearNames = () => { slideImgs.forEach(i => i.style.viewTransitionName = ''); sources.forEach(i => i.style.viewTransitionName = ''); };
  const withTransition = (fn, from, to) => {
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { fn(); return; }
    let done = false;
    const run = () => { if (done) return; done = true; from.style.viewTransitionName = ''; fn(); to().style.viewTransitionName = 'viewer-img'; };
    from.style.viewTransitionName = 'viewer-img';
    const tr = document.startViewTransition(run);
    tr.finished.finally(clearNames);
    // 保險：瀏覽器若沒能及時跑動畫，直接完成開關，避免卡住
    setTimeout(() => { if (!done) { tr.skipTransition(); run(); clearNames(); } }, 700);
  };
  function open(n) {
    load(n);
    const show = () => {
      v.classList.add('open'); isOpen = true; document.body.style.overflow = 'hidden';
      go(n, false);
    };
    const target = slideImgs[n];
    const run = () => withTransition(show, sources[n], () => target);
    target.complete && target.naturalWidth ? run() : (target.onload = () => { target.onload = null; run(); }, setTimeout(() => { if (!isOpen) run(); }, 400));
  }
  function close() {
    if (!isOpen) return;
    unzoom();
    const hide = () => { v.classList.remove('open'); isOpen = false; document.body.style.overflow = ''; v.style.opacity = ''; slides[index].style.transform = ''; };
    sources[index].scrollIntoView({ block: 'nearest' });
    withTransition(hide, slideImgs[index], () => sources[index]);
  }
  v.querySelector('.v-close').addEventListener('click', close);
  track.addEventListener('click', e => { if (e.target === track || e.target.classList.contains('v-slide')) close(); });
  addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') go(index - 1);
    if (e.key === 'ArrowRight') go(index + 1);
  });

  // 放大細看：點兩下或按「＋」，放大時可以拖曳移動
  let zoomed = null, sx = 0, sy = 0, tx = 0, ty = 0, drag = null;
  function zoomAt(img, cx, cy) {
    const r = img.getBoundingClientRect();
    zoomed = img; tx = (r.left + r.width / 2 - cx) * 1.5; ty = (r.top + r.height / 2 - cy) * 1.5;
    img.classList.add('zoomed', 'anim'); img.style.transform = `translate(${tx}px, ${ty}px) scale(2.5)`;
    setTimeout(() => img.classList.remove('anim'), 360);
    track.classList.add('locked'); zoomBtn.textContent = '－';
  }
  function unzoom() {
    if (!zoomed) return;
    zoomed.classList.add('anim'); zoomed.style.transform = '';
    const z = zoomed; setTimeout(() => z.classList.remove('zoomed', 'anim'), 360);
    zoomed = null; track.classList.remove('locked'); zoomBtn.textContent = '＋';
  }
  zoomBtn.addEventListener('click', () => {
    if (zoomed) { unzoom(); return; }
    const r = slideImgs[index].getBoundingClientRect(); zoomAt(slideImgs[index], r.left + r.width / 2, r.top + r.height / 2);
  });
  slideImgs.forEach(img => {
    img.addEventListener('dblclick', e => { zoomed ? unzoom() : zoomAt(img, e.clientX, e.clientY); });
    let lastTap = 0;
    img.addEventListener('touchend', e => {                     // 手機點兩下放大
      const now = Date.now();
      if (now - lastTap < 300 && e.changedTouches[0]) { e.preventDefault(); const t = e.changedTouches[0]; zoomed ? unzoom() : zoomAt(img, t.clientX, t.clientY); }
      lastTap = now;
    });
    img.addEventListener('pointerdown', e => {
      if (zoomed !== img) return;
      drag = { x: e.clientX, y: e.clientY, tx, ty }; img.setPointerCapture(e.pointerId); img.style.cursor = 'grabbing';
    });
    img.addEventListener('pointermove', e => {
      if (!drag || zoomed !== img) return;
      tx = drag.tx + (e.clientX - drag.x); ty = drag.ty + (e.clientY - drag.y);
      img.style.transform = `translate(${tx}px, ${ty}px) scale(2.5)`;
    });
    img.addEventListener('pointerup', () => { drag = null; img.style.cursor = ''; });
  });

  // 觸控往下拉關閉：拉動時圖片跟著手指、背景變淡，放開超過門檻就關閉
  let pull = null;
  track.addEventListener('touchstart', e => {
    if (zoomed || e.touches.length !== 1) return;
    pull = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: false };
  }, { passive: true });
  track.addEventListener('touchmove', e => {
    if (!pull) return;
    const dx = e.touches[0].clientX - pull.x, dy = e.touches[0].clientY - pull.y;
    if (!pull.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.3 && dy > 0) { pull.active = true; track.classList.add('locked'); v.classList.add('dragging'); }
      else if (Math.abs(dx) > 12) { pull = null; return; }
    }
    if (pull && pull.active) {
      e.preventDefault();
      slides[index].style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy, 400) / 2000})`;
      v.style.opacity = String(1 - Math.min(dy, 400) / 600);
    }
  }, { passive: false });
  track.addEventListener('touchend', e => {
    if (!pull || !pull.active) { pull = null; return; }
    const dy = e.changedTouches[0].clientY - pull.y;
    pull = null; track.classList.remove('locked'); v.classList.remove('dragging');
    if (dy > 110) { close(); }
    else { slides[index].style.transition = 'transform .3s'; slides[index].style.transform = ''; v.style.opacity = ''; setTimeout(() => slides[index].style.transition = '', 300); }
  });
})();
