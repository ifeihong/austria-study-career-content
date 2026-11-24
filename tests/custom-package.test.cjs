'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib');
const {sealPackage,auditCustomPackage}=require('../scripts/custom-package.cjs');
function crc32(b){let n=0xffffffff;for(const byte of b){n^=byte;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function png(seed){const chunk=(name,data)=>{const tag=Buffer.from(name),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([n,tag,data,crc]);};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1080);ihdr.writeUInt32BE(1440,4);ihdr[8]=8;ihdr[9]=6;const pixels=Buffer.alloc((1080*4+1)*1440);pixels[1]=seed;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);}
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'austria-custom-test-'));fs.mkdirSync(path.join(dir,'source/assets'),{recursive:true});fs.mkdirSync(path.join(dir,'images'));
 const post={title:'冬日散步',brand:'奥地利求学就业桔',style:'S3',template:'T4',templateVariant:'winter',medium:'photo',publish:{title:'冬天的晚上去散步',body:'沿着亮灯的街道慢慢走。',topics:['奥地利生活']},pages:[{id:'cover',text:'看见冬日生活的一个片段',image:'assets/scene.png'},{id:'list',text:'点单前先确认饮品和杯具押金',image:'assets/detail.png'}],outputs:[{id:'cover',file:'images/01.png'},{id:'list',file:'images/02.png'}],files:['source/build.py','source/assets/scene.png','source/assets/detail.png']};
 fs.writeFileSync(path.join(dir,'source/custom-post.json'),JSON.stringify(post));fs.writeFileSync(path.join(dir,'source/build.py'),'# fictional rendering fixture');
 for(const [file,seed] of [['source/assets/scene.png',1],['source/assets/detail.png',2],['images/01.png',3],['images/02.png',4]])fs.writeFileSync(path.join(dir,file),png(seed));
 const topics=post.publish.topics.map(t=>'#'+t).join(' ');for(const [file,value] of [['publish-title.txt',post.publish.title],['publish-body.txt',post.publish.body+'\n\n'+topics],['publish-topics.txt',topics]])fs.writeFileSync(path.join(dir,file),value);
 return {dir,post,write(){fs.writeFileSync(path.join(dir,'source/custom-post.json'),JSON.stringify(post));}};
}
test('custom seal and read-only audit retain one record per page without claiming visual verification',()=>{
 const {dir}=fixture(),r=sealPackage(dir);assert.equal(r.pageCount,2);assert.equal(r.coverage.textPageCount,2);assert.equal(r.coverage.imagePageCount,2);
 const before=fs.readFileSync(path.join(dir,'custom-manifest.json'));const audited=auditCustomPackage(dir);assert.equal(audited.visualReview,'required');assert.equal(audited.headerChecksOnly,true);assert.deepEqual(fs.readFileSync(path.join(dir,'custom-manifest.json')),before);
 assert.throws(()=>sealPackage(dir),/exists/);
});
test('changed source, output or publish text and extra PNG are rejected',()=>{
 for(const target of ['source/build.py','images/01.png','publish-body.txt']){const {dir}=fixture();sealPackage(dir);fs.appendFileSync(path.join(dir,target),'changed');assert.throws(()=>auditCustomPackage(dir),/mismatch|PNG/);}
 const {dir}=fixture();sealPackage(dir);fs.writeFileSync(path.join(dir,'images/extra.png'),png(9));assert.throws(()=>auditCustomPackage(dir),/extra|Unexpected|count/i);
});
test('missing declared source and silently omitted source files are refused',()=>{
 const a=fixture();a.post.files.push('source/missing.py');a.write();assert.throws(()=>sealPackage(a.dir),/ENOENT|missing/i);
 const b=fixture();fs.writeFileSync(path.join(b.dir,'source/conditions.txt'),'Important conditions');assert.throws(()=>sealPackage(b.dir),/unlisted|declared/i);
});
test('a page must contain actual text, IDs are unique, publish copy is exact and source scenes cannot repeat',()=>{
 const a=fixture();a.post.pages[1].text='';a.write();assert.throws(()=>sealPackage(a.dir),/text/i);
 const b=fixture();b.post.pages[1].id='cover';b.write();assert.throws(()=>sealPackage(b.dir),/duplicate/i);
 const c=fixture();fs.writeFileSync(path.join(c.dir,'publish-title.txt'),'another title');assert.throws(()=>sealPackage(c.dir),/Publishing|copy/i);
 const d=fixture();fs.copyFileSync(path.join(d.dir,'source/assets/scene.png'),path.join(d.dir,'source/assets/detail.png'));assert.throws(()=>sealPackage(d.dir),/Repeated scene/i);
});
test('evidence reuse requires a reason and does not exempt page or output checks',()=>{
 const a=fixture();fs.copyFileSync(path.join(a.dir,'source/assets/scene.png'),path.join(a.dir,'source/assets/detail.png'));for(const p of a.post.pages){p.imageRole='evidence';p.imageReuseReason='需要同一原文在两页分别解释不同字段';}a.write();assert.doesNotThrow(()=>sealPackage(a.dir));
 const b=fixture();b.post.pages[1].image='../outside.png';b.write();assert.throws(()=>sealPackage(b.dir),/relative|traversal|Unsafe/);
});
test('malformed output shape, misleading brand and unknown page content fields are rejected',()=>{
 const a=fixture();a.post.brand='奥地利求学就业橘';a.write();assert.throws(()=>sealPackage(a.dir),/brand|Brand/);
 const b=fixture();b.post.outputs.pop();b.write();assert.throws(()=>sealPackage(b.dir),/count|output/i);
 const c=fixture();c.post.pages[0].copy='不能漏掉';c.write();assert.throws(()=>sealPackage(c.dir),/Unknown page field/);
});

test('failed sealing leaves no manifest and identical final pages are rejected',()=>{
 const a=fixture();fs.copyFileSync(path.join(a.dir,'images/01.png'),path.join(a.dir,'images/02.png'));assert.throws(()=>sealPackage(a.dir),/Duplicate final/);
 assert.equal(fs.existsSync(path.join(a.dir,'custom-manifest.json')),false);
 const b=fixture();fs.writeFileSync(path.join(b.dir,'publish.md'),'stale review copy');assert.throws(()=>sealPackage(b.dir),/Publishing copy/);
});

test('source symlinks are refused rather than escaping a sealed package',t=>{
 const a=fixture(),outside=fs.mkdtempSync(path.join(os.tmpdir(),'austria-custom-outside-'));fs.writeFileSync(path.join(outside,'private.txt'),'private');
 try{fs.symlinkSync(outside,path.join(a.dir,'source/outside'),process.platform==='win32'?'junction':'dir');}catch(e){if(['EPERM','EACCES'].includes(e.code)){t.skip('Symlinks unavailable');return;}throw e;}
 assert.throws(()=>sealPackage(a.dir),/symlink|unlisted|declared/i);
});

test('a linked images directory is rejected even when its target remains inside the package',t=>{
 const a=fixture();fs.renameSync(path.join(a.dir,'images'),path.join(a.dir,'other-images'));
 try{fs.symlinkSync(path.join(a.dir,'other-images'),path.join(a.dir,'images'),process.platform==='win32'?'junction':'dir');}catch(e){if(['EPERM','EACCES'].includes(e.code)){t.skip('Symlinks unavailable');return;}throw e;}
 assert.throws(()=>sealPackage(a.dir),/symlink/i);
});

test('Windows CRLF copy compares as text while original line-ending bytes remain sealed',()=>{
 const a=fixture(),tags=a.post.publish.topics.map(t=>'#'+t).join(' ');
 for(const file of ['publish-title.txt','publish-body.txt','publish-topics.txt']){
  const p=path.join(a.dir,file);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll('\n','\r\n'));
 }
 const review='# 推荐标题\n\n'+a.post.publish.title+'\n\n# 正文\n\n'+a.post.publish.body+'\n\n# 话题\n\n'+tags+'\n';
 fs.writeFileSync(path.join(a.dir,'publish.md'),review.replaceAll('\n','\r\n'));
 assert.doesNotThrow(()=>sealPackage(a.dir));assert.doesNotThrow(()=>auditCustomPackage(a.dir));
 const p=path.join(a.dir,'publish-body.txt');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll('\r\n','\n'));
 assert.throws(()=>auditCustomPackage(a.dir),/publishHashes.*mismatch/);
});
