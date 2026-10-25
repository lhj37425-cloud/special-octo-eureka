const {render:renderBase}=require('./homepage-trust-sections.cjs');
const adminCore=require('./后台服务.cjs');

const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// 首页“公司资质”：读取后台已发布的资质；后台勾选“首页展示”的（最多 3 张）排最前，其余按发布时间从新到旧；某语言没有填写的条目不在该语言页面出现
function qualifications(language){
 return adminCore.list(true).filter(r=>r.type==='qualifications').sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(b.publishedAt||'').localeCompare(String(a.publishedAt||''))||((a.publishedSettings||a).order||0)-((b.publishedSettings||b).order||0)).map(r=>{const v=r.published[language]||{},image=v.image||r.published.zh?.image;return v.name&&image?[v.name,v.description||'',`/admin-media/${image.id}`]:null}).filter(Boolean);
}

function render(language='zh',faq=''){
 const items=qualifications(language);
 const cards=items.map(([title,description,source],index)=>`<article class="home-qualification-card${index>2?' is-extra':''}"${index>2?' hidden':''}><button type="button" class="home-qualification-image" data-home-qualification-preview data-preview-title="${esc(title)}" data-preview-src="${source}" aria-label="${esc(title)}"><img src="${source}" alt="${esc(title)}"><span>+</span></button><h3>${esc(title)}</h3><p>${esc(description)}</p></article>`).join('');
 const labels={zh:['查看全部资质','收起全部资质',`共 ${items.length} 项`],en:['View all qualifications','Show fewer qualifications',`${items.length} items`],vi:['Xem tất cả hồ sơ năng lực','Thu gọn hồ sơ năng lực',`${items.length} mục`]}[language]||['查看全部资质','收起全部资质',`共 ${items.length} 项`];
 const titles={zh:['以可核验资料，建立合作信任','以可核验资质，建立合作信任'],en:['Build trust with verifiable materials','Build trust with verifiable qualifications'],vi:['Xây dựng niềm tin bằng tài liệu có thể kiểm chứng','Xây dựng niềm tin bằng hồ sơ năng lực có thể kiểm chứng']}[language]||['以可核验资料，建立合作信任','以可核验资质，建立合作信任'];
 const more=items.length>3?`<button class="home-view-all" type="button" aria-expanded="false" aria-controls="home-qualification-grid" data-open-label="${labels[0]}" data-close-label="${labels[1]}"><span>${labels[0]}</span><b>${labels[2]}</b><i aria-hidden="true">↓</i></button>`:'';
 return renderBase(language,faq).replace(titles[0],titles[1]).replace(/<div class="home-qualification-grid" id="home-qualification-grid">[\s\S]*?<\/div><button class="home-view-all"[\s\S]*?<\/button>/,`<div class="home-qualification-grid" id="home-qualification-grid">${cards}</div>${more}`);
}

module.exports={render};
