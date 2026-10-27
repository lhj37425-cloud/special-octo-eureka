const copy={
 zh:{eyebrow:'03 / 业务场景',title:'从具体工作任务开始，让 AI 发挥作用',intro:'从业务价值、资料条件与人工复核方式出发，选择适合先试点的应用场景。',preview:'应用案例',application:'应用案例示意',more:'查看全部案例',browse:'{n} 个行业应用案例'},
 en:{eyebrow:'03 / BUSINESS SCENARIOS',title:'Start with a real work task, then make AI useful',intro:'Choose a suitable starting point based on business value, available materials and the required human review.',preview:'Use case',application:'Illustrative use case',more:'View all cases',browse:'{n} industry use cases'},
 vi:{eyebrow:'03 / TÌNH HUỐNG ỨNG DỤNG',title:'Bắt đầu từ một công việc cụ thể để AI phát huy tác dụng',intro:'Chọn tình huống phù hợp để thử nghiệm dựa trên giá trị kinh doanh, tài liệu sẵn có và cách kiểm tra của con người.',preview:'Tình huống',application:'Minh họa ứng dụng',more:'Xem tất cả tình huống',browse:'{n} tình huống theo ngành'}
};

function esc(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
// 首页 03 业务场景（深色）：上面一张大图，下面 3 个案例；鼠标移到或键盘选中哪个案例，大图就换成哪个，点击进入案例详情
function render(language='zh'){
 const t=copy[language]||copy.zh;
 // 首页案例来自后台“应用案例”：优先显示勾选“首页展示”的（最多 3 个），没有勾选时显示排在最前的 3 个
 const cases=require('./cases.cjs').loadCases(language),featured=cases.filter(c=>c.featured);
 const scenarios=(featured.length?featured:cases).slice(0,3).map(c=>{const d=c[language];return {no:c.no,name:d.title,label:d.industry,description:d.summary,tags:d.deliverables.slice(0,3),image:c.image,link:`/${language}/cases/${c.slug}/`}});
 if(!scenarios.length)return '';
 const initial=scenarios[0];
 const tabs=scenarios.map((s,index)=>`<a class="home-scn-tab${index===0?' is-active':''}" data-scenario data-no="${s.no}" data-label="${esc(s.label)}" data-image="${s.image}" data-title="${esc(s.name)}" data-tags="${esc(s.tags.join(' · '))}" href="${s.link}"><span class="home-scn-tab-top"><em>${s.no}</em><small>${esc(s.label)}</small></span><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></a>`).join('');
 return `<section class="business-scenarios v2-dark" id="scenarios" aria-labelledby="business-scenarios-title"><div class="container"><div class="home-head"><div><p class="eyebrow">${esc(t.eyebrow)}</p><h2 id="business-scenarios-title">${esc(t.title)}</h2></div><div><p>${esc(t.intro)}</p><a class="home-scn-more" href="/${language}/cases/">${esc(t.more)} · ${esc(t.browse.replace('{n}',cases.length))} <span aria-hidden="true">↗</span></a></div></div><div class="home-scn-hero" id="scenario-preview-image"><img src="${initial.image}" alt="${esc(initial.name)}" loading="lazy" decoding="async" width="1600" height="532"><span class="home-scn-tag">${esc(t.application)}</span><div class="home-scn-cap"><small>${esc(t.preview)} <b id="scenario-preview-no">${initial.no}</b> · <span id="scenario-preview-label">${esc(initial.label)}</span></small><strong id="scenario-preview-title">${esc(initial.name)}</strong><span id="scenario-preview-subtitle">${esc(initial.tags.join(' · '))}</span></div></div><div class="home-scn-tabs">${tabs}</div></div><script>(()=>{const board=document.querySelector('#scenarios');if(!board)return;const image=board.querySelector('#scenario-preview-image img'),no=board.querySelector('#scenario-preview-no'),label=board.querySelector('#scenario-preview-label'),title=board.querySelector('#scenario-preview-title'),subtitle=board.querySelector('#scenario-preview-subtitle');board.querySelectorAll('[data-scenario]').forEach(card=>{const show=()=>{board.querySelectorAll('[data-scenario]').forEach(item=>item.classList.toggle('is-active',item===card));image.src=card.dataset.image;image.alt=card.dataset.title;no.textContent=card.dataset.no;label.textContent=card.dataset.label;title.textContent=card.dataset.title;subtitle.textContent=card.dataset.tags};card.addEventListener('mouseenter',show);card.addEventListener('focus',show)})})()<\/script></section>`;
}

module.exports={render};
