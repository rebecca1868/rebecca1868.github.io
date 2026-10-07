// 作品內頁共用互動

// 捲過刊頭後，導覽列換成實心背景，避免壓在文字上
const header = document.querySelector('header');
const hero = document.querySelector('.hero');
const onScroll = () => header.classList.toggle('solid', scrollY > hero.offsetHeight - header.offsetHeight);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// 區塊捲進畫面時淡入
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
