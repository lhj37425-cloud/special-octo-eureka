// 首页滚动渐入：区块标题、卡片、问答、联系表单滚到眼前时淡入上移（样式在 v2-home.css 的 .home-reveal）。
// 系统设了“减少动态效果”、浏览器不支持 IntersectionObserver 时什么都不做；打开页面时已经在眼前的内容不隐藏，首屏和数字条不参与
(() => {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const groups = ['.home-head', '.home-about-copy', '.home-facts > div', '.home-svc', '.home-case', '.home-qualification-card:not([hidden])', '.home-cred-foot', '.home-cooperation-grid > li', '.home-faq .faq-layout > div', '.contact-copy', '.contact-form'];
  const items = [...document.querySelectorAll(groups.join(','))].filter(el => el.getBoundingClientRect().top > innerHeight);
  // 同一行的卡片依次出现，每张晚 0.08 秒
  const delay = el => Math.min([...el.parentElement.children].indexOf(el), 3) * 80;
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target, wait = delay(el);
    io.unobserve(el);
    el.style.transitionDelay = wait + 'ms';
    el.classList.add('is-in');
    // 出现完就去掉渐入的类名，卡片原来的上浮效果照常
    setTimeout(() => { el.classList.remove('home-reveal', 'is-in'); el.style.transitionDelay = ''; }, 700 + wait);
  }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach(el => { el.classList.add('home-reveal'); io.observe(el); });
})();
