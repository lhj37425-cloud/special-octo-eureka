import {uploadMedia} from './media.js';
export const languages={zh:'中文',en:'English',vi:'Tiếng Việt'};
export const types={qualifications:'公司资质',experts:'专家团队',courses:'课程管理',cases:'应用案例'};
export const emptyLang=()=>({name:'',org:'',description:'',validity:'',number:'',role:'',education:'',background:'',research:'',experience:'',audience:'',goals:'',outline:'',project:'',responsibility:'',results:'',industry:'',problem:'',steps:'',people:'',deliverables:'',highlight:'',evaluation:'',image:null,attachments:[],clips:[]});
export const clone=x=>structuredClone(x);
export const entered=v=>!!(v&&(v.name||v.org||v.description||v.image||v.attachments?.length||v.clips?.length||Object.entries(v).some(([k,x])=>!['attachments','clips','image'].includes(k)&&typeof x==='string'&&x.trim())));
export function missing(r,v){if(!entered(v))return ['未录入'];if(r.type==='cases')return [...(!v.name?['案例标题']:[]),...(!v.industry?['行业']:[]),...(!v.description?['简介']:[]),...(!v.image?['案例图片']:[]),...(!v.problem?['业务问题']:[]),...(!v.steps?['应用方式']:[]),...(!v.people?['人员分工']:[]),...(!v.deliverables?['交付成果']:[])];return [...(!v.name?[r.type==='experts'?'姓名':'名称']:[]),...(!v.description?['简介']:[]),...(!v.image?[r.type==='experts'?'照片':r.type==='qualifications'?'资质图片':'封面']:[])];}
export function blocking(r,v){if(!entered(v))return [];return missing(r,v);}
export function makeRecord(type){return {id:`${type.slice(0,3)}-${Date.now().toString(36)}`,type,category:'',order:10,experts:[],status:'draft',updated:new Date().toISOString(),draft:{zh:emptyLang(),en:emptyLang(),vi:emptyLang()},published:null};}
let csrf='',known=new Set(),serverCopies=new Map();
// 只提交本窗口真正改过的记录，避免多人同时使用时用旧数据覆盖别人刚保存的内容
const sig=r=>{const {updated,_action,...rest}=r;return JSON.stringify(rest)};
const remember=records=>{known=new Set(records.map(r=>r.id));serverCopies=new Map(records.map(r=>[r.id,sig(r)]))};
async function request(url,options={}){const method=(options.method||'GET').toUpperCase(),headers={'Content-Type':'application/json',...(options.headers||{})};if(!csrf)csrf=decodeURIComponent((document.cookie.split('; ').find(x=>x.startsWith('admin_csrf='))||'').slice('admin_csrf='.length));if(['POST','PUT','PATCH','DELETE'].includes(method)&&csrf)headers['X-CSRF-Token']=csrf;const response=await fetch(url,{credentials:'same-origin',...options,headers});const data=await response.json();if(!response.ok)throw Error(data.error||'操作失败');return data}
export async function login(account,password){const result=await request('/api/login',{method:'POST',body:JSON.stringify({account,password})});csrf=result.csrf;return result.user}
export async function setup(account,name,password){const result=await request('/api/setup',{method:'POST',body:JSON.stringify({account,name,password})});csrf=result.csrf;return result.user}
export async function status(){return request('/api/status')}
export async function me(){return (await request('/api/me')).user}
export async function changePassword(oldPassword,newPassword){return (await request('/api/password',{method:'POST',body:JSON.stringify({oldPassword,newPassword})})).user}
export async function listUsers(){return (await request('/api/users')).users}
export async function createUser(input){return (await request('/api/users',{method:'POST',body:JSON.stringify(input)})).user}
export async function updateUser(id,input){return (await request(`/api/users/${encodeURIComponent(id)}`,{method:'POST',body:JSON.stringify(input)})).user}
export async function resetUserPassword(id,password){return (await request(`/api/users/${encodeURIComponent(id)}/password`,{method:'POST',body:JSON.stringify({password})})).user}
export async function removeUser(id){await request(`/api/users/${encodeURIComponent(id)}`,{method:'DELETE'})}
export async function listLeads(){return (await request('/api/leads')).leads}
export async function updateLead(id,input){return (await request(`/api/leads/${encodeURIComponent(id)}`,{method:'POST',body:JSON.stringify(input)})).lead}
export async function removeLead(id){await request(`/api/leads/${encodeURIComponent(id)}`,{method:'DELETE'})}
export async function logout(){await request('/api/logout',{method:'POST'});csrf='';known.clear();serverCopies.clear()}
// 直接发文件字节（M9），不再转 base64；上传进度由 media.js 的 uploadMedia 提供
export async function upload(file,onProgress){return uploadMedia(file,{onProgress})}
export async function getSchema(){return (await request('/api/schema')).schema}
export async function getOptions(){return (await request('/api/options')).options}
export async function saveOptions(input){return (await request('/api/options',{method:'POST',body:JSON.stringify(input)})).options}
export async function setOrder(type,ids){return (await request('/api/order',{method:'POST',body:JSON.stringify({type,ids})})).records}
export async function publishRecord(id){return (await request(`/api/records/${encodeURIComponent(id)}/publish`,{method:'POST'})).record}
export async function offlineRecord(id){return (await request(`/api/records/${encodeURIComponent(id)}/offline`,{method:'POST'})).record}
export async function writeState(state){const next=new Set(state.records.map(r=>r.id).filter(Boolean));for(const id of known)if(!next.has(id))await request(`/api/records/${encodeURIComponent(id)}`,{method:'DELETE'});for(const local of state.records){const action=local._action;if(!action&&serverCopies.get(local.id)===sig(local))continue;const saved=(await request('/api/records',{method:'POST',body:JSON.stringify(local)})).record;if(action==='publish')await request(`/api/records/${encodeURIComponent(saved.id)}/publish`,{method:'POST'});else if(action==='offline')await request(`/api/records/${encodeURIComponent(saved.id)}/offline`,{method:'POST'});}state.records=(await readState()).records;return state}
export async function readState(){const result=await request('/api/records');const records=result.records.map(r=>({...r,updated:r.updatedAt}));remember(records);return {records}}
export async function resetState(){return readState()}
