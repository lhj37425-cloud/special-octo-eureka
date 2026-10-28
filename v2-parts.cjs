// 改版 v2 课程页、专家页共用的小部件：页面顶部“返回上一页 + 面包屑”、人物照片框、页尾深色咨询色带。
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text={
 zh:{back:'返回上一页',breadcrumb:'面包屑',home:'首页',cta:['咨询报名','围绕课程内容，交流适合您的学习与培训安排。','咨询课程安排']},
 en:{back:'Back',breadcrumb:'Breadcrumb',home:'Home',cta:['Enquire & enrol','Discuss learning and training arrangements for your team.','Discuss course arrangements']},
 vi:{back:'Quay lại',breadcrumb:'Đường dẫn điều hướng',home:'Trang chủ',cta:['Tư vấn đăng ký','Trao đổi về chương trình học phù hợp với đội ngũ.','Tư vấn khóa học']}
};
// 返回上一页：从本站其他页面点进来的，退回上一页；直接打开的（比如从搜索结果进来），去上一级页面。静态页用 server.js 的 staticBackLink，样子和做法相同
function back(l,href){return `<a class="v2-back" href="${href}" onclick="if(document.referrer.indexOf(location.origin+'/')===0&&history.length>1){event.preventDefault();history.back()}"><span aria-hidden="true">←</span> ${text[l].back}</a>`}
// trail：首页之后的各级，[文字, 链接]，最后一级（当前页）不带链接
function crumbs(l,trail,backHref){return `<div class="v2-crumbs">${back(l,backHref)}<nav class="breadcrumbs" aria-label="${text[l].breadcrumb}"><a href="/${l}/">${text[l].home}</a>${trail.map(([label,href])=>`<span aria-hidden="true">/</span>${href?`<a href="${href}">${esc(label)}</a>`:`<span>${esc(label)}</span>`}`).join('')}</nav></div>`}
// 人物照片框：统一裁成圆形（2026-10-28 用户定“一人一张表”，照片要求正方形、脸在中间）；没有照片显示姓氏
function photoBox(p,cls){const inner=p.photo?`<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy"${p.photoPos?` style="object-position:${esc(p.photoPos)}"`:''}>`:`<b class="v2-photo-initial" aria-hidden="true"><span>${esc([...String(p.name||'?')][0])}</span></b>`;return `<span class="v2-photo ${cls} is-round">${inner}</span>`}
// 页尾咨询色带（深色、居中），second 是第二个按钮
function cta(l,second=''){const [title,intro,action]=text[l].cta;return `<section class="v2-cta v2-dark"><div class="container"><h2>${title}</h2><p>${intro}</p><div class="v2-cta-acts"><a class="button primary" href="/${l}/contact/?service=training">${action} ↗</a>${second}</div></div></section>`}
module.exports={esc,crumbs,photoBox,cta};
