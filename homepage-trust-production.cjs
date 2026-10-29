const {render:renderBase}=require('./homepage-trust-sections.cjs');
const frontData=require('./前台数据.cjs');

const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// 首页“公司资质”：读取后台已发布的资质；后台勾选“首页展示”的（最多 3 张）排最前，其余按发布时间从新到旧；某语言没有填写的条目不在该语言页面出现
// 首页数字条的“N 项资质与认证”也用这里的条数，和资质区的“共 N 项”是同一个数
function qualifications(language,override=null){return frontData.qualifications(language,override)}

// 默认显示前 3 项，其余的先藏起来；卡片下面一行右边是“查看全部资质 · 共 N 项”，点开后其余的接在后面（三列）
function render(language='zh',faq='',override=null){
 const items=qualifications(language,override);
 const card=([title,description,source],index)=>`<article class="home-qualification-card${index>2?' is-extra':''}"${index>2?' hidden':''}><button type="button" class="home-qualification-image" data-home-qualification-preview data-preview-title="${esc(title)}" data-preview-src="${source}" aria-label="${esc(title)}"><img src="${source}" alt="${esc(title)}" loading="lazy" decoding="async"><span class="home-zoom" aria-hidden="true">+</span></button><div class="home-qualification-body"><h3>${esc(title)}</h3><p>${esc(description)}</p></div></article>`;
 const labels={zh:['查看全部资质','收起全部资质',`共 ${items.length} 项`],en:['View all qualifications','Show fewer qualifications',`${items.length} items`],vi:['Xem tất cả hồ sơ năng lực','Thu gọn hồ sơ năng lực',`${items.length} mục`]}[language]||['查看全部资质','收起全部资质',`共 ${items.length} 项`];
 const more=items.length>3?`<button class="home-view-all" type="button" aria-expanded="false" aria-controls="home-qualification-grid" data-open-label="${labels[0]}" data-close-label="${labels[1]}"><span>${labels[0]}</span><b>${labels[2]}</b><i aria-hidden="true">↓</i></button>`:'';
 const grid=items.length?`<div class="home-qualification-grid" id="home-qualification-grid">${items.map(card).join('')}</div>`:'';
 return renderBase(language,faq,grid,more);
}

module.exports={render,qualifications};
