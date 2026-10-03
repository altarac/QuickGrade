import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1095,height:930}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://quickgrade.test/**',async r=>r.fulfill({contentType:'text/html',body:await readFile('index.html','utf8')}));
await page.goto('https://quickgrade.test');
const quiz={id:'qr',title:'QR sheet check',numQuestions:5,options:['A','B','C','D'],answerKey:{1:'A',2:'B',3:'C',4:'D',5:'A'},pointsPerQuestion:1,submissions:[]};
await page.evaluate(q=>localStorage.setItem('quickgrade_quizzes_v2',JSON.stringify([q])),quiz);await page.reload();
assert.equal(await page.locator('header').getByText('OMR',{exact:true}).count(),0,'Brand badge remains');
await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();
await page.addScriptTag({content:await readFile('node_modules/jsqr/dist/jsQR.js','utf8')});
const decodeCanvas=async(selector)=>page.locator(selector).evaluate(canvas=>{
 const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
 return window.jsQR(data.data,data.width,data.height)?.data;
});
const target='https://altarac.github.io/QuickGrade/#scan';
assert.equal(await decodeCanvas('canvas'),target,'Preview QR did not decode to scanning');
const reduced=await page.locator('canvas').evaluate(canvas=>{
 const small=document.createElement('canvas');small.width=600;small.height=800;small.getContext('2d').drawImage(canvas,0,0,600,800);
 const d=small.getContext('2d').getImageData(0,0,600,800);return window.jsQR(d.data,600,800)?.data;
});
assert.equal(reduced,target,'QR failed in a reduced sheet image');
await page.screenshot({path:'tests/qr-sheet-desktop.png',fullPage:true});
// Printing and downloading must contain the same working QR.
await page.evaluate(()=>window.print=()=>window.__printed=true);
await page.getByRole('button',{name:'Print Sheet Now',exact:true}).click();
await page.waitForFunction(()=>window.__printed);
const printed=await page.locator('#print-sheet').evaluate(image=>{
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 canvas.getContext('2d').drawImage(image,0,0);const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);return window.jsQR(d.data,d.width,d.height)?.data;
});
assert.equal(printed,target,'Printed QR differs');
const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download PNG',exact:true}).click();
const download=await pending;const stream=await download.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);
const downloaded=await page.evaluate(async url=>{
 const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);
 const d=c.getContext('2d').getImageData(0,0,c.width,c.height);return window.jsQR(d.data,d.width,d.height)?.data;
},'data:image/png;base64,'+Buffer.concat(chunks).toString('base64'));
assert.equal(downloaded,target,'Downloaded QR differs');
await page.setViewportSize({width:390,height:844});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.screenshot({path:'tests/qr-sheet-mobile.png',fullPage:true});
// Follow the encoded fragment against the isolated updated app, using an existing quiz.
await page.goto('https://quickgrade.test/'+new URL(target).hash);
await page.getByRole('heading',{name:'OMR Camera Scanner'}).waitFor();
assert.equal(await page.getByRole('button',{name:'Scan',exact:true}).getAttribute('aria-current'),'page');
assert.equal(await page.getByRole('button',{name:'Start Camera',exact:true}).count(),1,'QR launch unexpectedly requested the camera automatically');
await page.evaluate(()=>localStorage.removeItem('quickgrade_quizzes_v2'));await page.reload();
await page.getByRole('heading',{name:'Welcome to QuickGrade'}).waitFor();
assert.deepEqual(errors,[]);
console.log('Brand badge removed; preview, print, download and reduced-sheet QR decode; link opens Scan for an existing quiz and onboarding for a new device; mobile fits.');
await browser.close();
