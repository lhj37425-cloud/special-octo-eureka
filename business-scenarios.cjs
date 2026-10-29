const copy={
 zh:{eyebrow:'03 / 业务场景',title:'从具体工作任务开始，让 AI 发挥作用',intro:'从业务价值、资料条件与人工复核方式出发，选择适合先试点的应用场景。',application:'应用案例示意',more:'查看全部案例'},
 en:{eyebrow:'03 / BUSINESS SCENARIOS',title:'Start with a real work task, then make AI useful',intro:'Choose a suitable starting point based on business value, available materials and the required human review.',application:'Illustrative use case',more:'View all cases'},
 vi:{eyebrow:'03 / TÌNH HUỐNG ỨNG DỤNG',title:'Bắt đầu từ một công việc cụ thể để AI phát huy tác dụng',intro:'Chọn tình huống phù hợp để thử nghiệm dựa trên giá trị kinh doanh, tài liệu sẵn có và cách kiểm tra của con người.',application:'Minh họa ứng dụng',more:'Xem tất cả tình huống'}
};

function esc(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
const arrow='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
// 首页 03 业务场景（浅色底）：三张案例卡，配图上压着行业、案例名和两行简介（2026-10-28 用户定），点卡片进入案例详情
function render(language='zh'){
 const t=copy[language]||copy.zh;
 // 首页案例来自后台“应用案例”：优先显示勾选“首页展示”的（最多 3 个），没有勾选时显示排在最前的 3 个
 const cases=require('./cases.cjs').loadCases(language),featured=cases.filter(c=>c.featured);
 const scenarios=(featured.length?featured:cases).slice(0,3).map(c=>{const d=c[language];return {no:c.no,name:d.title,label:d.industry,description:d.summary,image:c.image,link:`/${language}/cases/${c.slug}/`}});
 if(!scenarios.length)return '';
 // 配图是 AI 生成的示意图，左上角标“应用案例示意 · 编号”
 const cards=scenarios.map(s=>`<a class="home-case" href="${s.link}"><span class="home-case-img"><img src="${s.image}" alt="" loading="lazy" decoding="async" width="1600" height="532"><em>${esc(t.application)} · ${s.no}</em></span><span class="home-case-body"><small>${esc(s.label)}</small><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></span></a>`).join('');
 return `<section class="business-scenarios" id="scenarios" aria-labelledby="business-scenarios-title"><div class="container"><div class="home-head"><div><p class="eyebrow">${esc(t.eyebrow)}</p><h2 id="business-scenarios-title">${esc(t.title)}</h2><p>${esc(t.intro)}</p></div><a class="home-head-link" href="/${language}/cases/">${esc(t.more)}${arrow}</a></div><div class="home-case-grid">${cards}</div></div></section>`;
}

module.exports={render};
