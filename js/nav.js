// 導覽列：往下滑時收起、往上滑時出現
const bar = document.querySelector('header');
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  if (Math.abs(y - lastY) < 6) return;           // 忽略很小的抖動
  bar.classList.toggle('nav-hidden', y > lastY && y > 120);
  lastY = y;
}, { passive: true });
