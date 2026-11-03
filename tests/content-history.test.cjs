const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {candidate,checkHistory,recordHistory,listHistory,historyRoot}=require('../scripts/content-history.cjs');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'austria-history-test-'));
const draft=()=>({title:'家庭预算的支付节奏',publish:{title:'先看什么时候付款',body:'家庭预算不能只看最终总额。先区分一次性搬家、长期生活和押金预付，逐项记录周期、支付节点和可退条件。再按家庭共同目标整理还没有依据的数字，不把押金误作日常消费。',topics:['家庭预算']},pages:[{title:'区分支付周期',items:[{heading:'一次性费用',text:'搬家与安家用品单独列出。'},{heading:'可退项目',text:'押金预付核对退回条件。'}]}]});
test('normalize decoration and detect renamed duplicate text, with auditable intentional override',()=>{
 const root=temp(),a=candidate(draft());recordHistory(root,a,{now:'2026-11-02T17:00:00Z'});
 const b=draft();b.title='全新标题！';b.publish.title='换标题也不能重复';b.publish.topics=['奥地利生活'];b.publish.body='🌿 '+b.publish.body.replaceAll('。','！');
 assert.equal(checkHistory(root,candidate(b)).decision,'block');
 assert.throws(()=>recordHistory(root,candidate(b)),/Duplicate/);
 const saved=recordHistory(root,candidate(b),{reason:'用户明确要求比较相同内容的另一个版本'});
 assert.ok(saved.overrideReason);assert.equal(listHistory(root).length,2);
 assert.equal(listHistory(root,{date:'2026-11-03'}).length>=1,true);
});
test('highly similar wording is blocked but new information on same topic is not',()=>{
 const root=temp(),a=draft();recordHistory(root,candidate(a));
 const near=structuredClone(a);near.publish.body+='还可以记录付款人。';near.pages[0].items[0].text+='逐项登记。';
 assert.equal(checkHistory(root,candidate(near)).decision,'block');
 const different={title:a.title,body:'家庭预算里的通勤距离：比较住址到学校与工作地点的公共交通换乘、步行时间以及家庭接送安排，把日常路线画成活动半径图。'};
 assert.notEqual(checkHistory(root,candidate(different)).decision,'block');
});
test('records are grouped by Shanghai day, revisions retain work lineage, corrupt records fail closed',()=>{
 const root=temp(),a=candidate(draft());const first=recordHistory(root,a,{now:'2026-11-02T17:00:00Z'});
 assert.equal(first.day,'2026-11-03');assert.ok(fs.existsSync(path.join(root,first.day,first.id+'.json')));
 const revision=recordHistory(root,a,{revisionOf:first.id});assert.equal(revision.workId,first.workId);
 assert.equal(listHistory(root).length,2);assert.throws(()=>checkHistory(root,a,{revisionOf:'missing'}),/Unknown revision/);
 fs.writeFileSync(path.join(root,first.day,'broken.json'),'{');assert.throws(()=>checkHistory(root,a),/Invalid history/);
});
test('history storage defaults outside skill and records identical image hashes',()=>{
 const dir=temp();fs.writeFileSync(path.join(dir,'a.png'),'same bytes');fs.writeFileSync(path.join(dir,'b.png'),'same bytes');
 const a=candidate({title:'图一',body:'场景说明',pages:[{image:'a.png'}]},dir);
 const b=candidate({title:'图二',body:'另一个新场景说明',pages:[{image:'b.png'}]},dir);
 const root=path.join(dir,'ledger');recordHistory(root,a);assert.equal(checkHistory(root,b).matches[0].sharedImages,1);
 assert.ok(!historyRoot().startsWith(path.resolve(__dirname,'..')+path.sep));
});

test('public skill paths are refused and an active write lock is preserved',()=>{
 assert.throws(()=>historyRoot(path.resolve(__dirname,'../content-history')),/outside/);
 const root=temp();fs.mkdirSync(path.join(root,'.lock'));
 assert.throws(()=>recordHistory(root,candidate(draft())),/locked/);
 assert.ok(fs.existsSync(path.join(root,'.lock')));
 assert.equal(listHistory(root).length,0);
});
