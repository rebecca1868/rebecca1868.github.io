// 圖片載入效果：圖片外框先顯示素色底，圖片本身先隱藏，
// 等整張下載並解碼完成後再一次淡入，避免看到圖片一段一段畫出來。
document.querySelectorAll('.hero img, figure img, .thumb img').forEach(img => {
  img.parentElement.classList.add('img-wait');

  const show = () => img.classList.add('loaded');
  img.addEventListener('load', () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(show));
  img.addEventListener('error', show);
  if (img.complete && img.naturalWidth) show();
});
