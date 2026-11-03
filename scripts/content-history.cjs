'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function ensure(ok,message){if(!ok)throw new Error(message);}
function historyRoot(explicit){
 let configured=explicit||process.env.AUSTRIA_CONTENT_HISTORY_DIR;
 const config=path.join(__dirname,'../history.local.json');
 if(!configured&&fs.existsSync(config)){const c=JSON.parse(fs.readFileSync(config,'utf8').replace(/^\uFEFF/,''));configured=c.directory;ensure(typeof configured==='string','history.local.json needs directory');}
 const root=configured||path.join(os.homedir(),'.austria-study-career-content','history');
 ensure(path.isAbsolute(root),'History directory must be absolute');
 const resolved=path.resolve(root),skill=path.resolve(__dirname,'..'),rel=path.relative(skill,resolved);
 ensure(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel),'History must be outside the public skill directory');
 // Resolve existing ancestors too, so a junction cannot place records inside the public skill.
 let ancestor=resolved;while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
 const real=fs.realpathSync(ancestor),skillReal=fs.realpathSync(skill),realRel=path.relative(skillReal,real);
 ensure(realRel==='..'||realRel.startsWith('..'+path.sep)||path.isAbsolute(realRel),'History junction points inside the public skill directory');
 return resolved;
}
function pageText(p){return [p.title,p.subtitle,...(p.items||[]).flatMap(x=>[x.heading,x.text]),...(p.columns||[]),...(p.rows||[]).flat()].filter(Boolean).join('\n');}
function candidate(input,base=process.cwd()){
 ensure(input&&typeof input==='object'&&!Array.isArray(input),'Content input must be a JSON object');
 const title=input.publish?.title||input.title;ensure(typeof title==='string'&&title.trim(),'Content title required');
 const body=input.publish?.body||input.body||input.script||input.summary||'';ensure(typeof body==='string','body/script/summary must be text');
 const pages=input.pages||[];ensure(Array.isArray(pages),'pages must be an array');
 const pagesText=pages.map(pageText).join('\n');ensure(body.trim()||pagesText.trim(),'Content text required');
 const images=pages.filter(p=>p.image).map(p=>{
  ensure(typeof p.image==='string'&&!path.isAbsolute(p.image)&&!p.image.split(/[\\/]/).includes('..')&&!/^[a-z]+:/i.test(p.image),'Image path must be local and relative');
  const file=fs.realpathSync(path.resolve(base,p.image)),rel=path.relative(fs.realpathSync(base),file);
  ensure(rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel),'Image outside input directory');
  return sha(fs.readFileSync(file));
 });
 const normalized={title:normalize(title),body:normalize(body),pages:normalize(pagesText)};
 return {title,platform:input.platform||'xiaohongshu',topic:input.topic||input.title||title,audience:input.audience||'',angle:input.angle||'',summary:input.summary||'',normalized,contentHash:sha(normalized.body+'\n'+normalized.pages),images:[...new Set(images)],snapshot:structuredClone(input)};
}
function listHistory(directory,filter={}){
 const root=historyRoot(directory);if(!fs.existsSync(root))return [];
 if(filter.date)ensure(/^\d{4}-\d{2}-\d{2}$/.test(filter.date),'date must be YYYY-MM-DD');
 const records=[];
 for(const day of fs.readdirSync(root).sort()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||(filter.date&&day!==filter.date))continue;
  const folder=path.join(root,day);ensure(fs.lstatSync(folder).isDirectory()&&!fs.lstatSync(folder).isSymbolicLink(),'Invalid history day directory');
  for(const file of fs.readdirSync(folder).filter(x=>x.endsWith('.json')).sort()){
   try{const f=path.join(folder,file);ensure(!fs.lstatSync(f).isSymbolicLink(),'Record must not be a symbolic link');const record=JSON.parse(fs.readFileSync(f,'utf8'));ensure(record.schemaVersion===1&&typeof record.id==='string'&&record.id+'.json'===file&&record.day===day&&typeof record.workId==='string'&&['title','body','pages'].every(k=>typeof record.content?.normalized?.[k]==='string')&&typeof record.content.contentHash==='string'&&Array.isArray(record.content.images)&&record.content.images.every(x=>typeof x==='string'),'Invalid record schema');records.push(record);}
   catch(error){throw new Error('Invalid history record '+path.join(day,file)+': '+error.message);}
  }
 }
 return records.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
function grams(s){const a=Array.from(s);return new Set(a.length<2?a:a.slice(0,-1).map((c,i)=>c+a[i+1]));}
function dice(a,b){if(!a||!b)return 0;const x=grams(a),y=grams(b);let overlap=0;for(const v of x)if(y.has(v))overlap++;return 2*overlap/(x.size+y.size);}
function compare(a,b){
 const body=dice(a.normalized.body,b.normalized.body),pages=dice(a.normalized.pages,b.normalized.pages),title=dice(a.normalized.title,b.normalized.title);
 const exact=a.contentHash===b.contentHash||['body','pages'].some(k=>a.normalized[k].length>=40&&a.normalized[k]===b.normalized[k]);
 const near=['body','pages'].some(k=>{const x=a.normalized[k],y=b.normalized[k];return Math.min(x.length,y.length)>=60&&Math.min(x.length,y.length)/Math.max(x.length,y.length)>=.7&&dice(x,y)>=.88;});
 const sharedImages=a.images.filter(x=>b.images.includes(x)).length;
 return {level:exact?'duplicate':near?'high-similarity':'review',bodySimilarity:+body.toFixed(3),pageSimilarity:+pages.toFixed(3),titleSimilarity:+title.toFixed(3),sharedImages,score:Math.max(body,pages,title*.6)};
}
function checkHistory(directory,item,options={}){
 const records=listHistory(directory);const parent=options.revisionOf?records.find(r=>r.id===options.revisionOf):null;
 ensure(!options.revisionOf||parent,'Unknown revision record');
 const matches=records.filter(r=>!parent||r.workId!==parent.workId).map(r=>({recordId:r.id,workId:r.workId,day:r.day,title:r.content.title,topic:r.content.topic,...compare(item,r.content)})).filter(m=>m.level!=='review'||m.score>=.3||m.sharedImages>0).sort((a,b)=>b.score-a.score);
 const blocked=matches.some(m=>m.level!=='review');
 return {decision:blocked?'block':matches.length?'review':'clear',recordsChecked:records.length,worksChecked:new Set(records.map(r=>r.workId)).size,revisionWorkId:parent?.workId||null,matches:matches.slice(0,10),scope:'Only this local ledger; lexical similarity is not semantic or platform-wide verification'};
}
function assertAllowed(report,reason){
 if(reason!==undefined)ensure(typeof reason==='string'&&reason.trim().length>=8,'Override reason must contain at least 8 characters');
 ensure(report.decision!=='block'||reason,'Duplicate or highly similar content found; rework it, identify an existing-work revision, or provide an explicit history reason');
}
function recordHistory(directory,item,options={}){
 const root=historyRoot(directory);fs.mkdirSync(root,{recursive:true});const lock=path.join(root,'.lock');
 try{fs.mkdirSync(lock);}catch(error){if(error.code==='EEXIST')throw new Error('History is locked by another writer; retry after it completes. Do not remove a live lock.');throw error;}
 try{
  const check=checkHistory(root,item,options);assertAllowed(check,options.reason);
  const date=new Date(options.now||Date.now());ensure(Number.isFinite(date.getTime()),'Invalid record time');
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const id=crypto.randomUUID(),record={schemaVersion:1,id,workId:check.revisionWorkId||id,revisionOf:options.revisionOf||null,day,createdAt:date.toISOString(),timeZone:'Asia/Shanghai',status:options.status||'generated',outputPath:options.outputPath?path.resolve(options.outputPath):null,overrideReason:options.reason||null,check,content:item};
  const folder=path.join(root,day);fs.mkdirSync(folder,{recursive:true});const tmp=path.join(folder,id+'.tmp'),file=path.join(folder,id+'.json');
  fs.writeFileSync(tmp,JSON.stringify(record,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,file);return record;
 }finally{fs.rmdirSync(lock);}
}
function cli(args){
 const command=args.shift(),opts={};ensure(['check','record','list'].includes(command),'Usage: content-history.cjs check|record|list [--input file] [--dir absolute-path] [--date YYYY-MM-DD] [--revision-of record-id] [--reason explanation]');
 for(let i=0;i<args.length;i+=2){ensure(['--input','--dir','--date','--revision-of','--reason'].includes(args[i])&&args[i+1]&&!args[i+1].startsWith('--'),'Invalid history option');ensure(opts[args[i]]===undefined,'Duplicate history option');opts[args[i]]=args[i+1];}
 const root=historyRoot(opts['--dir']);if(command==='list'){ensure(!opts['--input']&&!opts['--revision-of']&&!opts['--reason'],'list accepts only dir and date');const records=listHistory(root,{date:opts['--date']});console.log(JSON.stringify({directory:root,count:records.length,records},null,2));return;}
 ensure(opts['--input']&&!opts['--date'],'check/record requires input and does not accept date');const input=path.resolve(opts['--input']);const item=candidate(JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'')),path.dirname(input));const options={revisionOf:opts['--revision-of'],reason:opts['--reason']};
 const result=command==='check'?checkHistory(root,item,options):recordHistory(root,item,options);console.log(JSON.stringify(result,null,2));if(command==='check'&&result.decision==='block')process.exitCode=2;
}
module.exports={candidate,checkHistory,recordHistory,listHistory,historyRoot,assertAllowed};
if(require.main===module)try{cli(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
