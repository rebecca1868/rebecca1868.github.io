// 圖片瀏覽器：頁面上有 data-viewer 的圖片，點擊後開啟。
// - data-viewer：放大時用的圖片網址
// - data-viewer-extra：同一件作品的其他照片（JSON 陣列，選填）；data-viewer-extra-sm 為對應的小圖
// - data-viewer-set：同一組的圖片可以互相切換（例如插畫頁全部一組；實體頁每件作品各自一組）
// - 圖片所在 <figure> 裡的 figcaption 和 .v-info 會顯示在下方
// 功能：從原位置放大進入、關閉時縮回；左右滑動、方向鍵、底部縮圖；點兩下放大細看；觸控往下拉關閉
(() => {
  const sources = [...document.querySelectorAll('img[data-viewer]')];
  if (!sources.length) return;
  const parse = s => { try { return JSON.parse(s || '[]'); } catch (e) { return []; } };

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

  let slides = [], slideImgs = [], thumbBtns = [], owners = [];   // owners[i]：第 i 張屬於哪張原圖
  let index = 0, isOpen = false;

  // 每張圖都縮放到填滿可用空間（保持比例），解析度不同的圖顯示起來一樣大
  const fit = im => {
    if (!im.naturalWidth || !im.parentElement || !im.parentElement.clientWidth) return;
    const s = im.parentElement, r = Math.min(s.clientWidth / im.naturalWidth, s.clientHeight / im.naturalHeight);
    im.style.width = Math.floor(im.naturalWidth * r) + 'px'; im.style.height = Math.floor(im.naturalHeight * r) + 'px';
  };
  addEventListener('resize', () => slideImgs.forEach(fit));
  const load = n => { const im = slideImgs[n]; if (im && !im.src) im.src = im.dataset.src; else if (im) fit(im); };
  const captionOf = src => {
    const fig = src.closest('figure');
    const fc = fig && fig.querySelector('figcaption'), info = fig && fig.querySelector('.v-info');
    let html = src.alt;
    if (fc) { const c = fc.cloneNode(true); c.querySelectorAll('.hint').forEach(h => h.remove()); html = c.innerHTML; }
    if (info) html += `<div class="v-more">${info.innerHTML}</div>`;
    return html;
  };

  // 依照被點的那張，組出這次要瀏覽的所有照片
  function build(src) {
    const set = src.dataset.viewerSet || 'all';
    const group = sources.filter(s => (s.dataset.viewerSet || 'all') === set);
    track.innerHTML = ''; thumbs.innerHTML = '';
    slides = []; slideImgs = []; thumbBtns = []; owners = [];
    group.forEach(s => {
      const big = [s.dataset.viewer || s.src, ...parse(s.dataset.viewerExtra)];
      const small = [s.currentSrc || s.src, ...parse(s.dataset.viewerExtraSm)];
      big.forEach((url, k) => {
        const n = slides.length;
        const slide = document.createElement('div'); slide.className = 'v-slide';
        const img = document.createElement('img'); img.alt = s.alt; img.dataset.src = url;
        img.addEventListener('load', () => fit(img));
        bindZoom(img);
        slide.appendChild(img); track.appendChild(slide);
        const t = document.createElement('button'); t.setAttribute('aria-label', `第 ${n + 1} 張`);
        t.innerHTML = `<img src="${small[k] || url}" alt="">`;
        t.addEventListener('click', () => go(n));
        thumbs.appendChild(t);
        slides.push(slide); slideImgs.push(img); thumbBtns.push(t); owners.push(s);
      });
    });
    thumbs.style.display = slides.length > 1 ? '' : 'none';
    return owners.indexOf(src);
  }

  const update = n => {
    index = n;
    slides.forEach((s, i) => s.classList.toggle('current', i === n));
    thumbBtns.forEach((b, i) => b.classList.toggle('on', i === n));
    if (thumbBtns[n]) thumbBtns[n].scrollIntoView({ inline: 'center', block: 'nearest' });
    count.textContent = slides.length > 1 ? `${n + 1} / ${slides.length}` : '';
    cap.innerHTML = captionOf(owners[n]);
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
  function open(src, k = 0) {
    const n = build(src) + k;
    load(n);
    const show = () => {
      v.classList.add('open'); isOpen = true; document.body.style.overflow = 'hidden';
      go(n, false);
    };
    const target = slideImgs[n];
    let started = false;
    const run = () => { if (started) return; started = true; withTransition(show, src, () => target); };
    if (target.complete && target.naturalWidth) run();
    else { target.addEventListener('load', run, { once: true }); setTimeout(run, 400); }
  }
  function close() {
    if (!isOpen) return;
    unzoom();
    const owner = owners[index], cur = slideImgs[index];
    const hide = () => { v.classList.remove('open'); isOpen = false; document.body.style.overflow = ''; v.style.opacity = ''; slides[index].style.transform = ''; };
    owner.scrollIntoView({ block: 'nearest' });
    withTransition(hide, cur, () => owner);
  }
  sources.forEach(src => {
    src.style.cursor = 'zoom-in';
    src.addEventListener('click', e => { e.preventDefault(); open(src); });
    // 其他程式可以要求從這件作品的第 k 張開啟（例如卡片裡已經滑到第二張）
    src.addEventListener('viewer:open', e => open(src, e.detail || 0));
  });
  // 網址帶有 #代號（例如從其他頁的連結過來）時，直接打開那一件
  const h = decodeURIComponent(location.hash.slice(1));
  if (h) {
    const target = sources.find(s => s.dataset.viewerSet === h || (s.dataset.viewer || '').includes('/' + h + '.'));
    if (target) addEventListener('load', () => { target.scrollIntoView({ block: 'center' }); setTimeout(() => open(target), 300); });
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
  let zoomed = null, tx = 0, ty = 0, drag = null;
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
  function bindZoom(img) {
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
  }

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
