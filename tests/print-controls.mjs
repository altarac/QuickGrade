import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1266,height:931}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const p=CanvasRenderingContext2D.prototype,fill=p.fillRect,arc=p.arc,text=p.fillText;
  p.fillRect=function(x,y,w,h){if(x===0&&y===0&&w===this.canvas.width&&h===this.canvas.height){this.canvas.__circles=[];this.canvas.__texts=[];window.__latestSheet=this.canvas;}return fill.call(this,x,y,w,h);};
  p.arc=function(x,y,r,...rest){(this.canvas.__circles??=[]).push({x,y,r});return arc.call(this,x,y,r,...rest);};
  p.fillText=function(value,...args){(this.canvas.__texts??=[]).push(String(value));return text.call(this,value,...args);};
 });
 await page.route('https://quickgrade.test/**',async r=>r.fulfill({contentType:'text/html',body:await readFile('index.html','utf8')}));
 await page.goto('https://quickgrade.test');
 const quiz={id:'choices',title:'Five-question quiz',numQuestions:5,options:['A','B','C','D'],answerKey:{1:'A',2:'B',3:'C',4:'D',5:'A'},pointsPerQuestion:1,submissions:[]};
 await page.evaluate(q=>localStorage.setItem('quickgrade_quizzes_v2',JSON.stringify([q])),quiz);await page.reload();
 assert.equal(await page.getByText('Pro Tip:',{exact:true}).count(),0);
 for(const name of ['ABCD Pattern','Randomize'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
 await page.screenshot({path:'tests/clean-key-desktop.png',fullPage:true});
 const source=(await Promise.all(['src/types/quizModel.js','src/utils/sheetLayout.js','src/utils/omrEngine.js'].map(f=>readFile(f,'utf8')))).map(s=>s.replace(/^import .*;\n/gm,'').replace(/export /g,'')).join('\n');
 await page.addScriptTag({content:await readFile('node_modules/jsqr/dist/jsQR.js','utf8')});
 const checkImage=async (imageUrl,choiceCount)=>page.evaluate(async({imageUrl,source,choiceCount})=>{
  const api=new Function(source+';return {scanBubbleSheet};')();
  const image=new Image();image.src=imageUrl;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);
  const q=JSON.parse(localStorage.getItem('quickgrade_quizzes_v2'))[0],d=c.getContext('2d').getImageData(0,0,c.width,c.height),scan=api.scanBubbleSheet(c,q);
  if(q.options.length!==choiceCount||Object.keys(scan.answers).length!==5||Object.values(scan.answers).some(a=>a.selected!=='BLANK'))throw new Error('Printed/downloaded sheet did not match the selected quiz or was marked');
  return window.jsQR(d.data,d.width,d.height)?.data;
 },{imageUrl,source,choiceCount});
 for(const choices of ['ABCD','ABCDE']){
  await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();
  assert.equal(await page.getByText(/Virtual Interactive Sheet Tester/).count(),0);
  for(const name of ['Fill 100% Score','Fill 80% Score','Clear Marks','Test Phone Scanner'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
  assert.equal(await page.locator('main').getByText(/OMR/).count(),0);
  await page.getByLabel('Answer choices',{exact:true}).selectOption(choices);
  const sheet=page.getByRole('img',{name:`20-row ${choices} bubble sheet; only rows 1–5 are graded`,exact:true});await sheet.waitFor();
  const drawing=await sheet.evaluate(c=>({circles:c.__circles.filter(a=>a.r>15),texts:c.__texts,url:c.toDataURL()}));
  assert.equal(drawing.circles.length,20*choices.length);
  assert.ok(drawing.texts.includes('Answer questions 1–5.'));
  assert.ok(drawing.texts.includes('Leave questions 6–20 blank.'));
  assert.equal(drawing.texts.some(t=>t.includes('OMR')),false);
  await sheet.click({position:{x:150,y:220}});
  assert.equal(await sheet.evaluate(c=>c.toDataURL()),drawing.url,'Preview still allows simulated marks');
  assert.equal(await checkImage(drawing.url,choices.length),'https://altarac.github.io/QuickGrade/#scan');
  await page.evaluate(()=>{window.__printed=false;window.print=()=>window.__printed=true;});
  await page.getByRole('button',{name:'Print Sheet Now',exact:true}).click();await page.waitForFunction(()=>window.__printed);
  assert.equal(await page.evaluate(()=>window.__latestSheet.__circles.filter(a=>a.r>15).length),20*choices.length);
  assert.equal(await checkImage(await page.locator('#print-sheet').getAttribute('src'),choices.length),'https://altarac.github.io/QuickGrade/#scan');
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download PNG',exact:true}).click();
  const download=await pending;assert.ok(download.suggestedFilename().includes('_'+choices+'_'));
  const stream=await download.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);
  assert.equal(await checkImage('data:image/png;base64,'+Buffer.concat(chunks).toString('base64'),choices.length),'https://altarac.github.io/QuickGrade/#scan');
  // Fill the actual rendered form, then upload it to the app's real scanner.
  const marked=await sheet.evaluate((c,source)=>{
   const api=new Function(source+';return {getSheetLayout,mapPoint};')(),q=JSON.parse(localStorage.getItem('quickgrade_quizzes_v2'))[0],layout=api.getSheetLayout(q.numQuestions,q.options);
   const out=document.createElement('canvas');out.width=c.width;out.height=c.height;const ctx=out.getContext('2d');ctx.drawImage(c,0,0);ctx.fillStyle='#111';
   const corners={tl:{x:72,y:80},tr:{x:1128,y:80},bl:{x:72,y:1520},br:{x:1128,y:1520}};
   for(let n=1;n<=q.numQuestions;n++){const opt=layout.questions[n].options[q.answerKey[n]],p=api.mapPoint(opt.u,opt.v,corners);ctx.beginPath();ctx.arc(p.x,p.y,opt.radius*1056*.88,0,Math.PI*2);ctx.fill();}
   return out.toDataURL();
  },source);
  await page.getByRole('button',{name:'Scan',exact:true}).click();
  await page.locator('input[type=file]').last().setInputFiles({name:'marked-'+choices+'.png',mimeType:'image/png',buffer:Buffer.from(marked.split(',')[1],'base64')});
  await page.getByRole('heading',{name:/Score: 5 \/ 5/}).waitFor();
  await page.getByRole('button',{name:'Discard & Rescan',exact:true}).click();
 }
 // E key values cannot silently disappear when reducing the number of choices.
 await page.getByRole('button',{name:'Answer Key',exact:true}).click();await page.getByRole('button',{name:'Question 5: E',exact:true}).click();
 await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();
 page.once('dialog',dialog=>dialog.dismiss());await page.getByLabel('Answer choices',{exact:true}).selectOption('ABCD');
 assert.equal(await page.getByLabel('Answer choices',{exact:true}).inputValue(),'ABCDE');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('quickgrade_quizzes_v2'))[0].answerKey[5]),'E');
 page.once('dialog',dialog=>dialog.accept());await page.getByLabel('Answer choices',{exact:true}).selectOption('ABCD');
 const changed=await page.evaluate(()=>JSON.parse(localStorage.getItem('quickgrade_quizzes_v2'))[0]);assert.equal(changed.answerKey[5],undefined);assert.equal(changed.answerKey[1],'A');
 await page.getByRole('button',{name:'Answer Key',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Question 5: E',exact:true}).count(),0);
 await page.getByRole('button',{name:'Question 5: A',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Number of questions'}).fill('20');await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();
 assert.ok(await page.locator('canvas').evaluate(c=>c.__texts.includes('Answer questions 1–20.')&&c.__texts.includes('No questions to leave blank.')));
 await page.getByRole('button',{name:'Answer Key',exact:true}).click();await page.getByRole('spinbutton',{name:'Number of questions'}).fill('19');await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();
 assert.ok(await page.locator('canvas').evaluate(c=>c.__texts.includes('Leave question 20 blank.')));
 await page.getByRole('button',{name:'Answer Key',exact:true}).click();await page.getByRole('spinbutton',{name:'Number of questions'}).fill('1');await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();
 assert.ok(await page.locator('canvas').evaluate(c=>c.__texts.includes('Answer question 1.')&&c.__texts.includes('Leave questions 2–20 blank.')));
 await page.getByRole('button',{name:'Answer Key',exact:true}).click();await page.getByRole('spinbutton',{name:'Number of questions'}).fill('5');await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();
 await page.getByLabel('Answer choices',{exact:true}).selectOption('ABCDE');
 await page.screenshot({path:'tests/clean-sheet-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tests/clean-sheet-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.reload();await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();assert.equal(await page.getByLabel('Answer choices',{exact:true}).inputValue(),'ABCDE');
 // Existing grade records keep their answer scheme.
 await page.evaluate(q=>{q.submissions=[{id:'saved',quizId:q.id,studentName:'Saved student',score:5,totalPossible:5,scannedAt:new Date().toISOString(),answers:Object.fromEntries(Array.from({length:5},(_,i)=>[i+1,{selected:q.answerKey[i+1]}]))}];localStorage.setItem('quickgrade_quizzes_v2',JSON.stringify([q]));},quiz);
 await page.reload();await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();assert.equal(await page.getByLabel('Answer choices',{exact:true}).isDisabled(),true);
 await page.getByText('Create a new quiz to change choices after saving grades.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('Removed tips/presets/tester; blank ABCD/ABCDE preview, print and PNG with QR; matching uploaded scores; safe E-key changes and saved records; exact 1/5/19/20 row instructions; persistence and mobile passed.');
} finally { await browser.close(); }
