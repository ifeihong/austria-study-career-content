'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validatePost}=require('./render-post.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function need(ok,message){if(!ok)throw new Error(message);}
function auditPackage(directory){
 const root=fs.realpathSync(directory);
 const read=relative=>{
  need(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'),'Unsafe package path');
  const file=fs.realpathSync(path.join(root,relative));
  const inside=path.relative(root,file);
  need(inside!==''&&inside!=='..'&&!inside.startsWith('..'+path.sep)&&!path.isAbsolute(inside),'Package file escapes directory');
  return fs.readFileSync(file);
 };
 const manifest=JSON.parse(read('manifest.json'));
 need(manifest.schemaVersion===1&&Array.isArray(manifest.pages),'Unsupported manifest');
 const expectedSources=['source/post.html','source/post.json','source/text-audit.json'];
 need(manifest.sourceHashes&&expectedSources.every(file=>typeof manifest.sourceHashes[file]==='string'),'Source hashes missing; re-export with the current renderer');
 for(const file of expectedSources)need(sha(read(file))===manifest.sourceHashes[file],'Source hash mismatch: '+file);
 const post=validatePost(JSON.parse(read('source/post.json')));
 need(post.pages.length===manifest.pages.length,'Page count mismatch');
 const ids=new Set();
 for(const [i,page] of manifest.pages.entries()){
  need(page.id===post.pages[i].id&&!ids.has(page.id),'Page order or duplicate ID mismatch');ids.add(page.id);
  need(/^images\/[a-z0-9-]+\.png$/.test(page.file),'Invalid image path');
  const bytes=read(page.file);
  need(sha(bytes)===page.sha256,'Image hash mismatch: '+page.file);
  need(bytes.length>24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(16)===1080&&bytes.readUInt32BE(20)===1440,'Invalid PNG size: '+page.file);
 }
 const actualImages=fs.readdirSync(path.join(root,'images')).filter(name=>/\.png$/i.test(name));
 need(actualImages.length===manifest.pages.length,'Unexpected extra or missing PNG images');
 const audit=JSON.parse(read('source/text-audit.json'));
 need(audit.exactInputMatch===true,'Rendered input text audit did not pass');
 for(const p of post.pages)if(p.image){const file='source/'+p.image;need(typeof manifest.sourceHashes[file]==='string'&&sha(read(file))===manifest.sourceHashes[file],'Source media hash mismatch: '+file);}
 if(post.publish){
  const topics=post.publish.topics.map(t=>'#'+t).join(' ');
  for(const [file,expected] of [['publish-title.txt',post.publish.title],['publish-body.txt',post.publish.body+'\n\n'+topics],['publish-topics.txt',topics]])need(read(file).toString('utf8')===expected,'Publishing copy differs from input: '+file);
  need(read('publish.md').toString('utf8')==='# 推荐标题\n\n'+post.publish.title+'\n\n# 正文\n\n'+post.publish.body+'\n\n# 话题\n\n'+topics+'\n','Publishing review document differs from input');
 }
 return {pages:post.pages.length,inputTextEntries:audit.entryCount,hashesMatch:true,publishFilesChecked:Boolean(post.publish),visualReview:manifest.visualReview,scope:'Local package integrity only; no policy, aesthetics, manuscript fidelity or platform upload verification.'};
}
module.exports={auditPackage};
if(require.main===module){try{need(process.argv.length===3,'Usage: node scripts/audit-package.cjs output/new-version');console.log(JSON.stringify(auditPackage(process.argv[2]),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
