const {esc,crumbs,photoBox}=require('./v2-parts.cjs');
const extra=require('./course-extra.cjs');
const labels={
 zh:{intro:'课程介绍',goals:'学完你能做到',outline:'课程大纲',preview:'学习预览',enquire:'咨询报名',action:'咨询课程安排',clip:'课程片段',enquireText:'围绕课程内容，交流适合您的学习与培训安排。',facts:'课程信息'},
 en:{intro:'Introduction',goals:'What you\'ll be able to do',outline:'Course outline',preview:'Learning preview',enquire:'Enquire & enrol',action:'Discuss course arrangements',clip:'Course clip',enquireText:'Discuss learning and training arrangements for your team.',facts:'Course facts'},
 vi:{intro:'Giới thiệu khóa học',goals:'Sau khóa học, bạn có thể',outline:'Nội dung khóa học',preview:'Học thử',enquire:'Tư vấn đăng ký',action:'Tư vấn khóa học',clip:'Video bài học',enquireText:'Trao đổi về chương trình học phù hợp với đội ngũ.',facts:'Thông tin khóa học'}
};
// 页面固定文字：三种语言各自一套，越南语不再借用英文
const words={
 zh:{breadcrumb:'面包屑',home:'首页',courses:'AI课程',back:'返回 AI 课程',audience:'适合人群',instructor:'授课讲师',play:'播放',colon:'：',separator:'、',emptyOutline:'课程内容将在开课前确认。',teacherDetail:'查看讲师介绍 →'},
 en:{breadcrumb:'Breadcrumb',home:'Home',courses:'AI Courses',back:'Back to AI courses',audience:'Audience',instructor:'Instructor',play:'Play',colon:': ',separator:', ',emptyOutline:'Course content will be confirmed before delivery.',teacherDetail:'View profile →'},
 vi:{breadcrumb:'Đường dẫn điều hướng',home:'Trang chủ',courses:'Khóa học AI',back:'Về khóa học AI',audience:'Đối tượng',instructor:'Giảng viên',play:'Phát',colon:': ',separator:', ',emptyOutline:'Nội dung khóa học sẽ được xác nhận trước khi khai giảng.',teacherDetail:'Xem hồ sơ →'}
};
const lines=value=>String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
// 概览里的一句话：前台补充资料有就用它，没有就用简介的第一句（完整简介在下面“课程介绍”）
function firstSentence(text){const s=String(text||'').trim(),i=s.search(/[。！？]|[.!?](\s|$)/);return i>=0?s.slice(0,i+1):s}
function duration(v){let n=Number(v);if(!Number.isFinite(n)||n<=0)return '--:--';n=Math.floor(n);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
// 课程详情（2026-10-28 按豆包 demo 的节奏重排）：概览（深色，含课程信息）→ 课程介绍、课程大纲两张白卡 → 学完你能做到 → 学习预览 → 咨询报名（深色，讲师卡 + 咨询）
function courseDetail(c,l,teachers){
 const d=labels[l],w=words[l],base=`/${l}/`,num=n=>String(n).padStart(2,'0');
 const more=extra[c.id]?.[l]||{};
 // 授课讲师按后台勾选的顺序；只显示这种语言里有内容的讲师
 const ids=c.teacherIds?.length?c.teacherIds:[c.teacherId].filter(Boolean);
 const team=ids.map(id=>teachers.find(p=>p.id===id)).filter(Boolean);
 if(!team.length&&c.teacher){const named=teachers.find(p=>p.name===c.teacher);if(named)team.push(named)}
 const outline=c.outline||[],videos=c.videos||[];
 const outcomes=more.outcomes||(c.goals||[]).map(x=>['',x]);
 const who=team.length?team.map(p=>`<a href="${base}teachers/${encodeURIComponent(p.id)}/">${esc(p.name)}</a>`).join(w.separator):esc(c.teacher||'—');
 const teach=team.length?`<div class="v2-teach">${team.map(p=>p.photo?`<img src="${esc(p.photo)}" alt="">`:'').join('')}<span>${w.instructor}${w.colon}${who}${team.length===1&&team[0].identity?`<small>${esc(team[0].identity)}</small>`:''}</span></div>`:'';
 const facts=more.facts?.length?`<dl class="v2-ov-facts" aria-label="${d.facts}">${more.facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`:'';
 const summary=more.summary||firstSentence(c.intro);
 const overview=`<section class="v2-ov v2-dark" id="course-overview" data-course-section><div class="container">${crumbs(l,[[w.courses,`${base}courses/`],[c.name]],`${base}courses/`)}<div class="v2-ov-grid"><div class="v2-ov-cover"><img src="${esc(c.cover||'/assets/course-workshop.png')}" alt="${esc(c.name)}">${videos.length?`<a class="v2-play" href="#course-preview" aria-label="${d.preview}"></a>`:''}</div><div class="v2-ov-copy">${c.category?`<p class="eyebrow">${esc(c.category)}</p>`:''}<h1>${esc(c.name)}</h1>${summary?`<p class="v2-ov-sum">${esc(summary)}</p>`:''}${facts}${teach}<div class="v2-ov-acts"><a class="button primary" href="#course-enquiry">${d.enquire} →</a>${videos.length?`<a class="button ghost" href="#course-preview">${d.preview} ↓</a>`:''}</div></div></div></div></section>`;
 // 课程介绍、课程大纲：两张白卡并排；适合人群、授课讲师放在介绍下面
 let n=0;
 const intro=`<section class="v2-intro" id="course-introduction" data-course-section><div class="container v2-intro-grid"><article class="v2-panel"><p class="eyebrow">${num(++n)}</p><h2>${d.intro}</h2><p class="v2-intro-text">${esc(c.intro)}</p><ul class="v2-meta"><li>${w.audience}${w.colon}${esc(c.audience||'—')}</li><li>${w.instructor}${w.colon}${who}</li></ul></article><article class="v2-panel" id="course-outline"><p class="eyebrow">${num(++n)}</p><h2>${d.outline}</h2><ol class="v2-outline${outline.length>8?' is-two':''}">${outline.map((x,i)=>`<li><b>${num(i+1)}</b>${esc(x)}</li>`).join('')||`<li>${w.emptyOutline}</li>`}</ol>${c.materials?.length?`<div class="mvp-resources">${c.materials.map(f=>`<a class="mvp-resource" href="${esc(f.url)}" download>${esc(f.name)} ↓</a>`).join('')}</div>`:''}</article></div></section>`;
 // 学完你能做到：打勾卡片，按条数分栏（1 条占满一行，2 条两列，3 条三列，4 条四列）；没有内容就整块不显示
 const objectives=outcomes.length?`<section class="v2-goals" id="course-objectives" data-course-section><div class="container"><div class="v2-head"><div><p class="eyebrow">${num(++n)}</p><h2>${d.goals}</h2></div></div><div class="v2-goal-grid n${Math.min(outcomes.length,4)}">${outcomes.map(([title,text])=>`<div class="v2-goal"><span class="v2-goal-mark" aria-hidden="true"></span><div>${title?`<h3>${esc(title)}</h3>`:''}<p>${esc(text)}</p></div></div>`).join('')}</div></div></section>`:'';
 // 学习预览：只有 1 个片段时左边标题、右边大视频；2 个两列，3 个以上三列，超过 6 个横向滑动
 const media=v=>`<div class="mvp-preview-media"><button class="mvp-preview-trigger" type="button" data-preview-src="${esc(v.url)}" aria-label="${esc(`${w.play} ${v.title||v.name}`)}"><img src="${esc(v.poster||c.cover||'/assets/course-workshop.png')}" alt="" loading="lazy"><span class="mvp-preview-play" aria-hidden="true">▶</span><span class="mvp-preview-duration">${duration(v.duration)}</span></button></div>`;
 const previewHead=()=>`<p class="eyebrow">${num(++n)}</p><h2>${d.preview}</h2>`;
 const preview=videos.length===1?`<section class="v2-preview" id="course-preview" data-course-section><div class="container v2-preview-one"><div class="v2-preview-copy">${previewHead()}<small>${d.clip} 01</small><h3>${esc(videos[0].title||videos[0].name)}</h3></div><article class="v2-clip">${media(videos[0])}</article></div></section>`:videos.length?`<section class="v2-preview" id="course-preview" data-course-section><div class="container"><div class="v2-head"><div>${previewHead()}</div></div><div class="v2-clip-grid n${Math.min(videos.length,3)}${videos.length>6?' is-scroll':''}">${videos.map((v,i)=>`<article class="v2-clip">${media(v)}<div class="v2-clip-cap"><small>${d.clip} ${num(i+1)}</small><h3>${esc(v.title||v.name)}</h3></div></article>`).join('')}</div></div></section>`:'';
 // 咨询报名（深色色带）：左边授课讲师卡，右边咨询
 const lead=team[0],creds=lead?(lead.highlights?.length?lead.highlights:lead.experience||lines(lead.aiTeachingExperience)).slice(0,3):[];
 const enquiry=`<section class="v2-enrol v2-dark" id="course-enquiry" data-course-section><div class="container v2-duo${lead?'':' is-single'}">${lead?`<div class="v2-tcard">${photoBox(lead,'v2-tcard-photo')}<div><p class="v2-role">${w.instructor}</p><h3>${esc(lead.name)}</h3>${lead.identity?`<p class="v2-tcard-role">${esc(lead.identity)}</p>`:''}${creds.length?`<ul class="v2-checks">${creds.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<a class="text-link" href="${base}teachers/${encodeURIComponent(lead.id)}/">${w.teacherDetail}</a></div></div>`:''}<div class="v2-enrol-copy"><p class="eyebrow">${num(++n)}</p><h2>${d.enquire}</h2><p>${d.enquireText}</p><a class="button primary" href="${base}contact/?service=training">${d.action} ↗</a></div></div></section>`;
 return overview+intro+objectives+preview+enquiry;
}
module.exports={courseDetail,words};
