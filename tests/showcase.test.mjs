import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256,verifyOriginal } from '../src/showcase/integrity.ts';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const records=JSON.parse(await read('public/data/recordings.json'));
test('all ten scenarios and the separately labeled Qwen capture are bundled',()=>{
 assert.equal(records.length,11);assert.equal(new Set(records.map(r=>r.scenario)).size,10);assert.equal(records.filter(r=>r.mode==='qwen').length,1);
});
for(const record of records)test(record.label+' has truthful metadata, untampered bytes and an intact original chain',async()=>{
 const data=await read('public/data/recordings/'+record.file);assert.equal(await sha256(data),record.sha256);
 const parsed=JSON.parse(data);assert.equal(parsed.events.length,record.events);assert.ok(parsed.events.some(e=>e.kind==='summary'&&e.final));
 assert.ok(parsed.events.every(e=>e.audience!=='control'&&!['inject','truth','scheduled'].includes(e.kind)));
 assert.ok(parsed.audit.entries.every(e=>!['inject','truth','scheduled'].includes(e.kind)));
 const original=await read('public/data/original/'+record.file);assert.equal((await verifyOriginal(original,record.original_sha256)).ok,true);
 const start=parsed.events.find(e=>e.kind==='run_meta');assert.equal(start.llm,record.mode==='qwen'?'local':'mock');
});
test('tampered bytes fail the bundle checksum',async()=>{const r=records[0];const text=await read('public/data/original/'+r.file);assert.equal((await verifyOriginal(text+' ',r.original_sha256)).ok,false);});
test('rewritten checksum cannot conceal an altered chain',async()=>{const r=records[0];const text=await read('public/data/original/'+r.file);const lines=text.split('\n');lines[0]=lines[0].replace('"actor":"system"','"actor":"changed"');const bad=lines.join('\n');assert.equal((await verifyOriginal(bad,await sha256(bad))).ok,false);});
test('transport rejects mutations before reaching fetch and App has no engine stream',async()=>{const api=await read('src/api.ts');assert.ok(api.includes("if(method!=='GET'||body!==undefined)throw"));const app=await read('src/App.tsx');assert.ok(!app.includes('<DataBridge'));assert.match(await read('src/sim/readOnly.ts'),/return true/);});
test('every scenario has a detailed briefing and provenance refers to the main repo',async()=>{for(const s of new Set(records.map(r=>r.scenario))){const d=JSON.parse(await read('public/data/scenarios/'+s+'.json'));assert.ok(d.scenario||d.events||d.id);}const p=JSON.parse(await read('public/data/provenance.json'));assert.equal(p.live_inference,false);assert.equal(p.team,'SolarSailor');});
