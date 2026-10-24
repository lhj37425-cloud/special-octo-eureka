const {render:renderBase}=require('./homepage-trust-sections.cjs');

const qualifications={
 zh:[
  ['中国国际化人才培养基地','由中国留学人才发展基金会授牌的人才培养基地。','/assets/qualification-international-talents-training-base.png'],
  ['国家级科技企业孵化器','国家科技部认定的国家级科技企业孵化器。','/assets/qualification-national-tech-incubator.png'],
  ['深港产学研基地博士后科研工作站','由全国博士后管理委员会设立的博士后科研工作站。','/assets/qualification-postdoctoral-station.png'],
  ['广东省中小企业创业服务机构示范单位','广东省中小企业创业服务机构示范单位资料。','/assets/qualification-guangdong-sme-service.png'],
  ['深圳市科普教育基地','深圳市科普教育基地资料。','/assets/qualification-science-education-base.png'],
  ['深圳市科协学术活动基地','深圳市科学技术协会学术活动基地资料。','/assets/qualification-science-association-base.png'],
  ['装备制造核心技术创新合作平台','深圳创新圈合作平台资料。','/assets/qualification-innovation-manufacturing-platform.png']
 ],
 en:[
  ['China International Talents Training Base','A talent-training base awarded by the China Overseas-Educated Scholars Development Foundation.','/assets/qualification-international-talents-training-base.png'],
  ['National Technology Business Incubator','A national-level technology business incubator recognized by China’s Ministry of Science and Technology.','/assets/qualification-national-tech-incubator.png'],
  ['Shenzhen–Hong Kong Industry-University-Research Base Postdoctoral Station','A postdoctoral research workstation established through China’s national postdoctoral administration.','/assets/qualification-postdoctoral-station.png'],
  ['Guangdong SME Entrepreneurship Service Institution Demonstration Unit','A demonstration-unit material for Guangdong SME entrepreneurship services.','/assets/qualification-guangdong-sme-service.png'],
  ['Shenzhen Science Education Base','A Shenzhen science education base material.','/assets/qualification-science-education-base.png'],
  ['Shenzhen Association for Science and Technology Academic Activities Base','A material for an academic activities base of the Shenzhen Association for Science and Technology.','/assets/qualification-science-association-base.png'],
  ['Equipment Manufacturing Core Technology Innovation Cooperation Platform','A Shenzhen innovation-circle cooperation-platform material.','/assets/qualification-innovation-manufacturing-platform.png']
 ],
 vi:[
  ['Cơ sở đào tạo nhân tài quốc tế Trung Quốc','Cơ sở đào tạo nhân tài được Quỹ Phát triển Nhân tài Du học Trung Quốc trao tặng.','/assets/qualification-international-talents-training-base.png'],
  ['Vườn ươm doanh nghiệp khoa học công nghệ cấp quốc gia','Vườn ươm doanh nghiệp khoa học công nghệ cấp quốc gia được Bộ Khoa học và Công nghệ Trung Quốc công nhận.','/assets/qualification-national-tech-incubator.png'],
  ['Trạm nghiên cứu sau tiến sĩ của Cơ sở hợp tác sản xuất - nghiên cứu - đào tạo Thâm Quyến - Hồng Kông','Trạm nghiên cứu sau tiến sĩ được thành lập theo cơ chế quản lý sau tiến sĩ cấp quốc gia của Trung Quốc.','/assets/qualification-postdoctoral-station.png'],
  ['Đơn vị trình diễn dịch vụ khởi nghiệp cho doanh nghiệp vừa và nhỏ Quảng Đông','Tài liệu về đơn vị trình diễn dịch vụ khởi nghiệp cho doanh nghiệp vừa và nhỏ Quảng Đông.','/assets/qualification-guangdong-sme-service.png'],
  ['Cơ sở giáo dục khoa học phổ thông Thâm Quyến','Tài liệu về cơ sở giáo dục khoa học phổ thông Thâm Quyến.','/assets/qualification-science-education-base.png'],
  ['Cơ sở hoạt động học thuật của Hiệp hội Khoa học và Công nghệ Thâm Quyến','Tài liệu về cơ sở hoạt động học thuật của Hiệp hội Khoa học và Công nghệ Thâm Quyến.','/assets/qualification-science-association-base.png'],
  ['Nền tảng hợp tác đổi mới công nghệ cốt lõi chế tạo thiết bị','Tài liệu về nền tảng hợp tác của Vòng tròn Đổi mới Thâm Quyến.','/assets/qualification-innovation-manufacturing-platform.png']
 ]
};

const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function render(language='zh',faq=''){
 const items=qualifications[language]||qualifications.zh;
 const cards=items.map(([title,description,source],index)=>`<article class="home-qualification-card${index>2?' is-extra':''}"${index>2?' hidden':''}><button type="button" class="home-qualification-image" data-home-qualification-preview data-preview-title="${esc(title)}" data-preview-src="${source}" aria-label="${esc(title)}"><img src="${source}" alt="${esc(title)}"><span>+</span></button><h3>${esc(title)}</h3><p>${esc(description)}</p></article>`).join('');
 const labels={zh:['查看全部资质','收起全部资质','共 7 项'],en:['View all qualifications','Show fewer qualifications','7 items'],vi:['Xem tất cả hồ sơ năng lực','Thu gọn hồ sơ năng lực','7 mục']}[language]||['查看全部资质','收起全部资质','共 7 项'];
 const titles={zh:['以可核验资料，建立合作信任','以可核验资质，建立合作信任'],en:['Build trust with verifiable materials','Build trust with verifiable qualifications'],vi:['Xây dựng niềm tin bằng tài liệu có thể kiểm chứng','Xây dựng niềm tin bằng hồ sơ năng lực có thể kiểm chứng']}[language]||['以可核验资料，建立合作信任','以可核验资质，建立合作信任'];
 return renderBase(language,faq).replace(titles[0],titles[1]).replace(/<div class="home-qualification-grid" id="home-qualification-grid">[\s\S]*?<\/div><button class="home-view-all"[\s\S]*?<\/button>/,`<div class="home-qualification-grid" id="home-qualification-grid">${cards}</div><button class="home-view-all" type="button" aria-expanded="false" aria-controls="home-qualification-grid" data-open-label="${labels[0]}" data-close-label="${labels[1]}"><span>${labels[0]}</span><b>${labels[2]}</b><i aria-hidden="true">↓</i></button>`);
}

module.exports={render};
