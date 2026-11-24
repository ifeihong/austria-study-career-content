const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertNodeVersion,checkEnvironment}=require('../scripts/check-env.cjs');

test('older Node fails with a useful version message before structuredClone is used',()=>{
 assert.throws(()=>assertNodeVersion('16.20.2'),/Node.js 20/);
 assert.doesNotThrow(()=>assertNodeVersion('20.0.0'));
 assert.throws(()=>assertNodeVersion('unknown'),/Node.js 20/);
});
test('core preflight is read-only and does not require rendering or Python dependencies',()=>{
 const r=checkEnvironment({mode:'core'});
 assert.equal(r.ok,true);assert.equal(r.mode,'core');assert.equal(r.checks.length,1);
 assert.equal(r.checks[0].name,'node');assert.throws(()=>checkEnvironment({mode:'install'}),/mode/);
});
test('missing render dependency or explicitly missing Python remains a visible failure',()=>{
 const r=checkEnvironment({mode:'render',playwrightModule:'module-that-does-not-exist'});
 assert.equal(r.ok,false);assert.ok(r.checks.some(x=>x.name==='playwright'&&!x.ok));
 const p=checkEnvironment({mode:'metrics',python:'missing-python-47291'});
 assert.equal(p.ok,false);assert.ok(p.checks.some(x=>x.name==='python'&&!x.ok));
});
