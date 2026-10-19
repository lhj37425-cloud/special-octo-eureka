const fs=require('fs'),path=require('path');
const core=require('./后台服务.cjs');

const root=__dirname;
const dataRoot=path.resolve(process.env.MVP_DATA_DIR||path.join(root,'data'));
const contentFile=path.join(dataRoot,'mvp-content.json');
const uploadsRoot=path.join(dataRoot,'mvp-uploads');
const migrationRoot=path.join(dataRoot,'migrations');
const demoCourses=['agent-101','ai-leadership'];
const demoExperts=['lin-che','zhou-lan'];
const ids={
  'lin-che':'exp-demo-lin-che',
  'zhou-lan':'exp-demo-zhou-lan',
  'agent-101':'cou-demo-agent-101',
  'ai-leadership':'cou-demo-ai-leadership'
};
const legacyTeacherIds={'林澈':'lin-che','周岚':'zhou-lan'};
const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>{const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2));try{fs.renameSync(temp,file)}catch(error){if(error.code!=='EPERM')throw error;fs.copyFileSync(temp,file);fs.unlinkSync(temp)}};
const blank=()=>({name:'',description:'',org:'',role:'',category:'',audience:'',outline:'',goals:'',education:'',background:'',research:'',experience:'',validity:'',number:'',responsibility:'',results:'',image:null,attachments:[],clips:[]});
function sourcePath(url){
  if(typeof url!=='string')return '';
  if(url.startsWith('/assets/'))return path.join(root,'assets',path.basename(url));
  if(url.startsWith('/uploads/'))return path.join(uploadsRoot,path.basename(url));
  return '';
}
function media(url){
  const file=sourcePath(url);
  if(!file||!fs.existsSync(file))return null;
  const extension=path.extname(file).toLowerCase();
  if(!mime[extension])throw Error(`不支持迁入文件：${url}`);
  return core.file(path.basename(file),fs.readFileSync(file),mime[extension]);
}
function text(value){return Array.isArray(value)?value.join('\n'):String(value||'')}
function language(item,lang,type){
  const source=lang==='zh'?item:(item.translations?.[lang]||{});
  const image=media(source.cover||source.photo||item.cover||item.photo);
  const value={...blank(),name:source.name||'',description:source.intro||source.description||'',category:source.category||item.category||'',audience:source.audience||item.audience||'',outline:text(source.outline||item.outline),goals:text(source.goals||item.goals)};
  if(type==='experts')Object.assign(value,{org:source.institution||item.institution||'',role:source.role||item.role||'',education:source.education||item.education||'',background:source.background||item.background||'',research:text(source.researchAreas||source.expertise||item.researchAreas||item.expertise),experience:[source.aiTeachingExperience||item.aiTeachingExperience,source.aiResearchExperience||item.aiResearchExperience,source.aiApplicationExperience||item.aiApplicationExperience].filter(Boolean).join('\n'),image});
  else {
    value.image=image;
    for(const video of source.videos||item.videos||[]){
      const clipVideo=media(video.url);
      if(clipVideo)value.clips.push({title:video.title||video.name||'课程预览',video:clipVideo,cover:media(video.poster||source.cover||item.cover)});
    }
  }
  return value;
}
function imported(type,id){return core.list().some(record=>record.id===ids[id]&&record.type===type)}
function courseExperts(item){
  const oldId=item.teacherId||legacyTeacherIds[item.teacher]||'';
  return ids[oldId]?[ids[oldId]]:[];
}
function create(type,item){
  const record=core.saveRecord({id:ids[item.id],type,order:Number(item.order)||0,experts:type==='courses'?courseExperts(item):[],draft:{zh:language(item,'zh',type),en:language(item,'en',type),vi:language(item,'vi',type)}});
  return core.publish(record.id);
}
function repairCourseLinks(courses){
  for(const course of courses){
    const current=core.list().find(record=>record.id===ids[course.id]);
    if(!current)throw Error(`未找到已迁入课程：${course.id}`);
    const saved=core.saveRecord({...current,experts:courseExperts(course)});
    core.publish(saved.id);
  }
}
function main(){
  const repair=process.argv.includes('--修复关联');
  let sourceFile=contentFile;
  if(repair){
    const backups=fs.existsSync(migrationRoot)?fs.readdirSync(migrationRoot).filter(name=>/^迁入前台虚拟内容-.*\.json$/.test(name)).sort():[];
    if(!backups.length)throw Error('未找到迁入前备份，不能安全修复关联。');
    sourceFile=path.join(migrationRoot,backups.at(-1));
  }
  if(!fs.existsSync(sourceFile))throw Error('未找到前台内容数据，未执行迁入。');
  const content=read(sourceFile);
  const courses=(content.courses||[]).filter(item=>demoCourses.includes(item.id));
  const experts=(content.teachers||[]).filter(item=>demoExperts.includes(item.id));
  if(courses.length!==demoCourses.length||experts.length!==demoExperts.length)throw Error('当前前台数据不完整，已停止迁入以避免误删。');
  const existing=[...demoExperts.map(id=>imported('experts',id)),...demoCourses.map(id=>imported('courses',id))];
  if(existing.some(Boolean)){
    if(existing.every(Boolean)&&repair){
      repairCourseLinks(courses);
      console.log('已修复迁入课程与专家的关联关系。');
      return;
    }
    throw Error('系统演示数据已迁入后台；为避免重复，未再次执行。');
  }
  if(process.argv.includes('--检查')){
    console.log(`迁入检查通过：将迁入 ${experts.length} 位专家、${courses.length} 门课程；其他前台记录保持不变。`);
    return;
  }
  fs.mkdirSync(migrationRoot,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const frontBackup=path.join(migrationRoot,`迁入前台虚拟内容-${stamp}.json`);
  const adminBackup=core.backup();
  fs.copyFileSync(contentFile,frontBackup);
  try{
    for(const expert of experts)create('experts',expert);
    for(const course of courses)create('courses',course);
    content.courses=content.courses.filter(item=>!demoCourses.includes(item.id));
    content.teachers=content.teachers.filter(item=>!demoExperts.includes(item.id));
    write(contentFile,content);
  }catch(error){
    core.restore(adminBackup);
    throw error;
  }
  console.log(`迁入完成：${experts.length} 位专家、${courses.length} 门课程已转入后台并保持已发布。`);
  console.log(`旧前台内容备份：${frontBackup}`);
  console.log(`后台完整备份：${adminBackup}`);
}

try{main()}catch(error){console.error(`迁入未完成：${error.message}`);process.exitCode=1}
