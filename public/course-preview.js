const previewTarget=document.querySelector('#course-preview');
const scrollToPreview=()=>previewTarget?.scrollIntoView({behavior:'smooth',block:'start'});
document.querySelectorAll('a[href="#course-preview"]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();history.pushState(null,'','#course-preview');scrollToPreview();}));
if(location.hash==='#course-preview')requestAnimationFrame(scrollToPreview);
document.querySelectorAll('[data-preview-src]').forEach(button=>{
const label=button.querySelector('.mvp-preview-duration');
if(label.textContent==='--:--'){const probe=document.createElement('video');let finished=false;const end=()=>{if(finished)return;finished=true;clearTimeout(timer);probe.removeAttribute('src');probe.load()};const update=()=>{if(Number.isFinite(probe.duration)&&probe.duration>0){const n=Math.floor(probe.duration);label.textContent=Math.floor(n/60)+':'+String(n%60).padStart(2,'0');end()}};const timer=setTimeout(end,10000);probe.preload='metadata';probe.onloadedmetadata=()=>{if(Number.isFinite(probe.duration))update();else{probe.ontimeupdate=update;probe.currentTime=1e10}};probe.onerror=end;probe.src=button.dataset.previewSrc;}
button.addEventListener('click',()=>{document.querySelectorAll('.mvp-preview-media video').forEach(v=>v.pause());const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=button.dataset.previewSrc;video.poster=button.querySelector('img').src;video.setAttribute('aria-label',button.getAttribute('aria-label'));button.hidden=true;button.parentElement.append(video);video.focus();video.load();video.play().catch(()=>{});});
});

