// Isolated generated-camera test. Does not access an existing tab or physical camera.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1151,height:930}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const scene=document.createElement('canvas');scene.width=1280;scene.height=960;scene.getContext('2d').fillStyle='#aaa';scene.getContext('2d').fillRect(0,0,1280,960);
 const video=document.createElement('canvas');video.width=1280;video.height=960;
 window.__cameraScene=scene;
 const paint=()=>{video.getContext('2d').drawImage(scene,0,0);requestAnimationFrame(paint);};requestAnimationFrame(paint);
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>video.captureStream(12),enumerateDevices:async()=>[{kind:'videoinput',deviceId:'generated',label:'Generated test camera'}]}});
});
// Route only a new test origin to the newly built HTML; no external requests or live-tab reads.
await page.route('https://quickgrade.test/**',async route=>route.fulfill({status:200,contentType:'text/html',body:await readFile('QuickGrade.html','utf8')}));
await page.goto('https://quickgrade.test');
const quiz={id:'live-test',title:'Live camera test',numQuestions:10,options:['A','B','C','D'],pointsPerQuestion:1,answerKey:Object.fromEntries(Array.from({length:10},(_,i)=>[i+1,'ABCD'[i%4]])),submissions:[]};
await page.evaluate(q=>localStorage.setItem('quickgrade_quizzes_v2',JSON.stringify([q])),quiz);await page.reload();
await page.getByRole('button',{name:'Scan',exact:true}).click();
await page.getByRole('button',{name:'Start Camera',exact:true}).click();
await page.getByText(/Markers: 0\/4/).waitFor();
await page.getByRole('button',{name:'Pause auto-capture',exact:true}).click();
const source=(await Promise.all(['src/types/quizModel.js','src/utils/sheetLayout.js','src/utils/omrEngine.js','src/utils/sheetGenerator.js'].map(f=>readFile(f,'utf8')))).map(s=>s.replace(/^import .*;\n/gm,'').replace(/export /g,'')).join('\n');
await page.evaluate(({source,quiz})=> {
 const api=new Function(source+';return {generateSimulatedTestSheet};')();
 const {canvas}=api.generateSimulatedTestSheet(quiz,'Camera Test',8);
 const scene=window.__cameraScene,ctx=scene.getContext('2d');ctx.fillStyle='#aaa';ctx.fillRect(0,0,1280,960);
 ctx.save();ctx.translate(640,480);ctx.rotate(12*Math.PI/180);ctx.drawImage(canvas,-300,-400,600,800);ctx.restore();
},{source,quiz});
await page.getByText(/Sheet detected: 10 answer rows/).waitFor({timeout:20000});
assert.equal(await page.locator('h3').filter({hasText:'Score:'}).count(),0,'Paused auto-capture unexpectedly captured');
const overlayInk=await page.getByLabel('Detected sheet and bubble positions').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n;});
assert.ok(overlayInk>1000,'No detected-position overlay');
await page.screenshot({path:'tests/live-detection.png',fullPage:true});
await page.getByRole('button',{name:'Enable auto-capture',exact:true}).click();
await page.getByRole('heading',{name:/Score: 8 \/ 10/}).waitFor({timeout:20000});
console.log('Generated video: blank scene reports 0/4 markers; a tilted sheet shows live outlines; paused mode keeps detection on; enabling auto-capture produces 8/10.');
assert.deepEqual(errors,[]);await browser.close();
