// 全站页头（2026-10-28 照豆包 demo，样式在 v2.css）：给 <html> 加上 .v2-header 以后，页面在最上面、压在深色首屏上时页头透明；
// 往下滚超过 40px，或者这一页开头不是深色首屏（如提交成功页），页头变成浅米色毛玻璃、深色字。
// 手机上打开菜单时页头保持深色，和深色的下拉菜单一致。浏览器不支持 :has 时首屏伸不到页头后面，就不改，页头保持深色
(() => {
  const header = document.querySelector('.site-header'), main = document.querySelector('main');
  if (!header || !main || !CSS.supports('selector(:has(*))')) return;
  const darkTop = !!main.firstElementChild?.matches('.page-hero, .v2-dark'), nav = header.querySelector('.main-nav');
  const update = () => header.classList.toggle('is-scrolled', (scrollY > 40 || !darkTop) && !nav?.classList.contains('is-open'));
  update();
  document.documentElement.classList.add('v2-header');
  // 打开页面时直接换好颜色，之后滚动时再渐变
  setTimeout(() => document.documentElement.classList.add('v2-header-ready'), 100);
  addEventListener('scroll', update, { passive: true });
  if (nav) new MutationObserver(update).observe(nav, { attributes: true, attributeFilter: ['class'] });
})();
