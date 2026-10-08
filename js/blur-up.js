// 模糊預覽 → 清晰圖片：
// 把每張圖內嵌的模糊小圖移到外框當背景，圖片本身先隱藏，
// 等整張下載並解碼完成後再一次淡入，避免看到圖片一段一段畫出來。
document.querySelectorAll('img[style*="background-image"]').forEach(img => {
  const box = img.parentElement;
  box.style.backgroundImage = img.style.backgroundImage;
  box.classList.add('blur-up');
  img.style.backgroundImage = '';

  const show = () => img.classList.add('loaded');
  img.addEventListener('load', () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(show));
  img.addEventListener('error', show);
  if (img.complete && img.naturalWidth) show();
});
