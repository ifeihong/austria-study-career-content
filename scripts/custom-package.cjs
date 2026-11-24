'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {candidate}=require('./content-history.cjs');
const {validatePublish,publishStats}=require('./render-post.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const normalizedNewlines=text=>text.replaceAll('\r\n','\n');
function need(ok,message){if(!ok)throw new Error(message);}
function json(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
function object(value,label){need(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object');}
function keys(value,allowed,label){for(const key of Object.keys(value))need(allowed.includes(key),'Unknown '+label+' field: '+key);}
function packageRoot(directory){need(typeof directory==='string'&&path.isAbsolute(directory),'Package directory must be absolute');const root=fs.realpathSync(directory);need(fs.statSync(root).isDirectory(),'Package directory required');return root;}
function localFile(root,relative){
 need(typeof relative==='string'&&relative.length>0&&!relative.includes('\\')&&!relative.includes(':')&&!path.isAbsolute(relative)&&!relative.split('/').some(p=>!p||p==='.'||p==='..'),'Unsafe local relative path: '+relative);
 const resolved=fs.realpathSync(path.join(root,relative)),rel=path.relative(root,resolved);
 need(rel&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel),'File escapes package: '+relative);
 need(fs.statSync(resolved).isFile(),'File required: '+relative);return resolved;
}
function filesBelow(root,relative){
 const directory=path.join(root,relative),result=[];
 need(fs.existsSync(directory)&&fs.statSync(directory).isDirectory(),'Missing directory: '+relative);
 need(!fs.lstatSync(directory).isSymbolicLink(),'Source/output symlinks are not accepted: '+relative);
 for(const name of fs.readdirSync(directory)){
  const file=relative+'/'+name,full=path.join(root,file);
  need(!fs.lstatSync(full).isSymbolicLink(),'Source/output symlinks are not accepted: '+file);
  if(fs.statSync(full).isDirectory())result.push(...filesBelow(root,file));else{localFile(root,file);result.push(file);}
 }return result.sort();
}
function sameNames(a,b){return JSON.stringify([...a].sort())===JSON.stringify([...b].sort());}
function checkPackage(directory){
 const root=packageRoot(directory),inputName='source/custom-post.json',post=json(localFile(root,inputName));object(post,'Custom post');
 keys(post,['title','brand','style','template','templateVariant','medium','topic','audience','angle','platform','primaryGoal','producer','createdAt','plannedPublishAt','publish','pages','outputs','files'],'custom post');
 need(typeof post.title==='string'&&post.title.trim(),'Custom title required');
 need(post.brand==='奥地利求学就业桔','Brand must be 奥地利求学就业桔');
 need(/^S[1-8]$/.test(post.style),'style must be S1 to S8');
 need(post.template==='custom'||/^T[1-8]$/.test(post.template),'template must be T1 to T8 or custom');
 if(post.templateVariant!==undefined)need(typeof post.templateVariant==='string'&&post.templateVariant.trim(),'templateVariant must be text');
 need(['photo','illustration','comic','evidence','mixed','none'].includes(post.medium),'Unknown medium');
 if(post.primaryGoal!==undefined)need(['attract','save','follow','questions','appreciation'].includes(post.primaryGoal),'Unknown primaryGoal');
 for(const key of ['topic','audience','angle','platform','producer','createdAt','plannedPublishAt'])if(post[key]!==undefined)need(typeof post[key]==='string',key+' must be text');
 need(typeof validatePublish==='function','Use the current renderer with exported validatePublish');
 const publish=validatePublish(structuredClone(post.publish));
 need(Array.isArray(post.pages)&&post.pages.length>0,'Actual pages required');
 need(Array.isArray(post.outputs)&&post.outputs.length===post.pages.length,'Output count must match actual pages');
 need(Array.isArray(post.files)&&post.files.every(f=>typeof f==='string'&&f.startsWith('source/')&&f!==inputName),'files must explicitly list source files other than custom-post.json');
 need(new Set(post.files).size===post.files.length,'Duplicate declared source file');
 const ids=new Set(),outputNames=new Set(),sourceHashes={},outputHashes={},publishHashes={};
 for(const relative of [inputName,...post.files])sourceHashes[relative]=sha(fs.readFileSync(localFile(root,relative)));
 const actualSources=filesBelow(root,'source');
 need(sameNames(actualSources,Object.keys(sourceHashes)),'Unlisted source files must be declared in files');
 const imageGroups=new Map();
 for(const [index,p] of post.pages.entries()){
  object(p,'Page');need(typeof p.id==='string'&&/^[a-z0-9][a-z0-9-]{0,48}$/.test(p.id),'Invalid page ID');
  need(!ids.has(p.id),'Duplicate page ID');ids.add(p.id);
  const content=candidate({title:post.title,template:post.template,pages:[p]},path.join(root,'source'));
  need(content.coverage.textPageCount===1,'Each actual page must contain nonempty text');
  const output=post.outputs[index];object(output,'Output');keys(output,['id','file'],'output');
  need(output.id===p.id,'Output order/ID mismatch');
  need(typeof output.file==='string'&&/^images\/[a-z0-9][a-z0-9-]*\.png$/.test(output.file),'Invalid output PNG path');
  need(!outputNames.has(output.file),'Duplicate output file');outputNames.add(output.file);
  const bytes=fs.readFileSync(localFile(root,output.file));
  need(bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(8)===13&&bytes.readUInt32BE(16)===1080&&bytes.readUInt32BE(20)===1440,'PNG header/dimension mismatch: '+output.file);
  outputHashes[output.file]=sha(bytes);
  if(p.image){
   need(typeof p.image==='string'&&!p.image.includes('\\'),'Image must use a local relative POSIX path');
   const relative='source/'+p.image;need(Object.hasOwn(sourceHashes,relative),'Image source must be declared in files: '+relative);
   const digest=sourceHashes[relative];const group=imageGroups.get(digest)||[];group.push(p);imageGroups.set(digest,group);
  }
 }
 need(sameNames(filesBelow(root,'images'),[...outputNames]),'Unexpected extra images or output count mismatch');
 need(new Set(Object.values(outputHashes)).size===post.pages.length,'Duplicate final page image');
 for(const group of imageGroups.values())if(group.length>1)need(group.every(p=>p.imageRole==='evidence'&&typeof p.imageReuseReason==='string'&&p.imageReuseReason.trim().length>=8),'Repeated scene source image; only explained evidence reuse is accepted');
 const tags=publish.topics.map(t=>'#'+t).join(' ');
 for(const [relative,value] of [['publish-title.txt',publish.title],['publish-body.txt',publish.body+'\n\n'+tags],['publish-topics.txt',tags]]){
  const bytes=fs.readFileSync(localFile(root,relative));need(normalizedNewlines(bytes.toString('utf8'))===normalizedNewlines(value),'Publishing copy mismatch: '+relative);publishHashes[relative]=sha(bytes);
 }
 if(fs.existsSync(path.join(root,'publish.md'))){
  const relative='publish.md',bytes=fs.readFileSync(localFile(root,relative));
  need(normalizedNewlines(bytes.toString('utf8'))===normalizedNewlines('# 推荐标题\n\n'+publish.title+'\n\n# 正文\n\n'+publish.body+'\n\n# 话题\n\n'+tags+'\n'),'Publishing copy mismatch: publish.md');
  publishHashes[relative]=sha(bytes);
 }
 const content=candidate({...post,publish},path.join(root,'source'));
 return {schemaVersion:1,kind:'custom-image-text',pageCount:post.pages.length,sourceHashes,outputHashes,publishHashes,coverage:content.coverage,publishStats:publishStats(publish),visualReview:'required',headerChecksOnly:true,scope:'Local declared-source/output integrity and PNG header/dimensions only. No image decoding, OCR, brand visibility, factual, aesthetic or platform upload verification.'};
}
function sealPackage(directory){
 const root=packageRoot(directory),target=path.join(root,'custom-manifest.json');need(!fs.existsSync(target),'Manifest already exists; use a new version directory');
 const result=checkPackage(root),temporary=path.join(root,'.custom-manifest-'+crypto.randomUUID()+'.tmp');
 try{fs.writeFileSync(temporary,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.linkSync(temporary,target);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 return result;
}
function auditCustomPackage(directory){
 const root=packageRoot(directory),manifest=json(localFile(root,'custom-manifest.json'));
 need(manifest.schemaVersion===1&&manifest.kind==='custom-image-text','Unsupported custom manifest');
 const result=checkPackage(root);
 for(const key of ['pageCount','sourceHashes','outputHashes','publishHashes','coverage','publishStats'])need(JSON.stringify(manifest[key])===JSON.stringify(result[key]),'Manifest '+key+' mismatch; re-export into a new version');
 return result;
}
module.exports={sealPackage,auditCustomPackage};
if(require.main===module){try{
 require('./check-env.cjs').assertNodeVersion();
 const args=process.argv.slice(2);need(args.length===3&&['seal','audit'].includes(args[0])&&args[1]==='--dir','Usage: node scripts/custom-package.cjs seal|audit --dir absolute-package-directory');
 const result=args[0]==='seal'?sealPackage(args[2]):auditCustomPackage(args[2]);console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}}
