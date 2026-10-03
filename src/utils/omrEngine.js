// Optical Mark Recognition (OMR) Computer Vision Engine
// Client-side pixel analysis; photos never leave the device.

import { getSheetLayout } from './sheetLayout.js';
import { calculateGrade } from '../types/quizModel.js';

// Compute the projective coefficients once for a batch of samples.
function createProjector(c) {
  const dx1=c.tr.x-c.br.x, dx2=c.bl.x-c.br.x;
  const dy1=c.tr.y-c.br.y, dy2=c.bl.y-c.br.y;
  const sx=c.tl.x-c.tr.x+c.br.x-c.bl.x, sy=c.tl.y-c.tr.y+c.br.y-c.bl.y;
  const det=dx1*dy2-dx2*dy1;
  const g=Math.abs(det)>1e-8 ? (sx*dy2-dx2*sy)/det : 0;
  const h=Math.abs(det)>1e-8 ? (dx1*sy-sx*dy1)/det : 0;
  const a=c.tr.x-c.tl.x+g*c.tr.x, b=c.bl.x-c.tl.x+h*c.bl.x;
  const d=c.tr.y-c.tl.y+g*c.tr.y, e=c.bl.y-c.tl.y+h*c.bl.y;
  return (u,v)=> {
    const z=g*u+h*v+1;
    return {x:(a*u+b*v+c.tl.x)/z,y:(d*u+e*v+c.tl.y)/z};
  };
}

export function mapPoint(u, v, c) {
  return createProjector(c)(u,v);
}

// Validate printed outlines in the original pixels. A normal sheet needs no full-page warp.
function layoutMatchesImage(imageData,width,height,corners,layout,quiz) {
  const project=createProjector(corners), data=imageData.data;
  const dark=(x,y)=> {
    x=Math.round(x);y=Math.round(y);
    if(x<0||x>=width||y<0||y>=height)return false;
    const k=(y*width+x)*4;
    return data[k]*.299+data[k+1]*.587+data[k+2]*.114<150;
  };
  return Object.values(layout.questions).every(q=>quiz.options.every(opt=> {
    const c=q.options[opt];let hits=0;
    for(let j=0;j<24;j++) {
      const t=j*Math.PI/12;let hit=false;
      for(const f of [.8,.9,1,1.1,1.2]) {
        const p=project(c.u+Math.cos(t)*c.radius*f,c.v+Math.sin(t)*c.radius*f*1056/1440);
        if(dark(p.x,p.y)||dark(p.x-1,p.y)||dark(p.x+1,p.y)||dark(p.x,p.y-1)||dark(p.x,p.y+1)){hit=true;break;}
      }
      if(hit)hits++;
    }
    return hits>=14;
  }));
}

export function detectCornerMarkers(imageData, width, height) {
  // Find connected square rings throughout the frame. Missing markers are never guessed.
  const step=Math.max(1,Math.ceil(Math.max(width,height)/1200));
  const w=Math.ceil(width/step), h=Math.ceil(height/step);
  const mask=new Uint8Array(w*h), queue=new Int32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const i=(Math.min(height-1,y*step)*width+Math.min(width-1,x*step))*4;
    mask[y*w+x]=(imageData.data[i]*.299+imageData.data[i+1]*.587+imageData.data[i+2]*.114)<110 ? 1 : 0;
  }
  const dark=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&mask[y*w+x]!==0;
  const candidates=[];
  for(let seed=0;seed<mask.length;seed++) {
    if(mask[seed]!==1) continue;
    let head=0,tail=1, minX=w,minY=h,maxX=0,maxY=0;
    queue[0]=seed; mask[seed]=2;
    while(head<tail) {
      const n=queue[head++], x=n%w,y=(n/w)|0;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const k of [x>0?n-1:-1,x<w-1?n+1:-1,y>0?n-w:-1,y<h-1?n+w:-1]) {
        if(k>=0&&mask[k]===1) {mask[k]=2;queue[tail++]=k;}
      }
    }
    const bw=maxX-minX+1,bh=maxY-minY+1,fill=tail/(bw*bh);
    if(bw<8||bh<8||bw>w*.15||bh>h*.15||bw/bh<.55||bw/bh>1.8||fill<.34) continue;
    // Verify a central black dot, a white annulus, and an outer black ring.
    // Radial tests tolerate rotation and do not require dark bounding-box corners.
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2,unit=Math.min(bw,bh);
    if(!dark(Math.round(cx),Math.round(cy)))continue;
    let whiteHits=0,outerHits=0;
    for(let j=0;j<16;j++) {
      const t=j*Math.PI/8;
      if([.14,.16,.18,.20].some(f=>!dark(Math.round(cx+Math.cos(t)*unit*f),Math.round(cy+Math.sin(t)*unit*f))))whiteHits++;
      if([.32,.36,.40,.44,.48].some(f=>dark(Math.round(cx+Math.cos(t)*unit*f),Math.round(cy+Math.sin(t)*unit*f))))outerHits++;
    }
    if(whiteHits<12||outerHits<12)continue;
    candidates.push({x:(minX+maxX)*step/2,y:(minY+maxY)*step/2,size:Math.sqrt(bw*bh)*step});
  }
  if(candidates.length<4) {const error=new Error(`Found ${Math.min(4,candidates.length)} of 4 corner markers. Show the whole printed sheet, face it toward the camera, and use even light.`);error.markerCount=candidates.length;error.markerCandidates=candidates;throw error;}
  // Candidate rings must surround the answer area and have comparable physical size.
  let best=null,bestArea=0;
  const extreme=(fn)=>[...candidates].sort((a,b)=>fn(a)-fn(b)).slice(0,8);
  for(const tl of extreme(p=>p.x/width+p.y/height))
  for(const tr of extreme(p=>-p.x/width+p.y/height))
  for(const bl of extreme(p=>p.x/width-p.y/height))
  for(const br of extreme(p=>-p.x/width-p.y/height)) {
    if(new Set([tl,tr,bl,br]).size!==4) continue;
    if(tr.x-tl.x<width*.2||br.x-bl.x<width*.2||bl.y-tl.y<height*.2||br.y-tr.y<height*.2) continue;
    const sizes=[tl,tr,bl,br].map(p=>p.size);
    if(Math.max(...sizes)/Math.min(...sizes)>2.5) continue;
    const poly=[tl,tr,br,bl];
    if(poly.some((p,i)=> {const b=poly[(i+1)%4],c=poly[(i+2)%4];return (b.x-p.x)*(c.y-b.y)-(b.y-p.y)*(c.x-b.x)<=0;})) continue;
    const area=Math.abs(poly.reduce((a,p,i)=>a+p.x*poly[(i+1)%4].y-p.y*poly[(i+1)%4].x,0))/2;
    const span=(Math.hypot(tr.x-tl.x,tr.y-tl.y)+Math.hypot(br.x-bl.x,br.y-bl.y))/2;
    if(sizes.some(sz=>sz/span<.025||sz/span>.095)) continue;
    if(area>bestArea) {bestArea=area;best={tl,tr,bl,br};}
  }
  if(!best) {const error=new Error('Markers found, but the sheet could not be aligned. Hold the whole sheet flat and upright toward the camera.');error.markerCount=candidates.length;error.markerCandidates=candidates;throw error;}
  return best;
}

export function inverseMapPoint(x, y, c) {
  const p00=mapPoint(0,0,c),p10=mapPoint(1,0,c),p01=mapPoint(0,1,c);
  const dx1=c.tr.x-c.br.x,dx2=c.bl.x-c.br.x,dy1=c.tr.y-c.br.y,dy2=c.bl.y-c.br.y;
  const sx=c.tl.x-c.tr.x+c.br.x-c.bl.x,sy=c.tl.y-c.tr.y+c.br.y-c.bl.y,det=dx1*dy2-dx2*dy1;
  const g=(sx*dy2-dx2*sy)/det,h=(dx1*sy-sx*dy1)/det;
  const a=p10.x-p00.x+g*p10.x,b=p01.x-p00.x+h*p01.x,d=p10.y-p00.y+g*p10.y,e=p01.y-p00.y+h*p01.y;
  const A=a-x*g,B=b-x*h,D=d-y*g,E=e-y*h,F=x-p00.x,G=y-p00.y,z=A*E-B*D;
  return {u:(F*E-B*G)/z,v:(A*G-F*D)/z};
}

export function detectBubbleLayout(imageData, width, height, corners, quiz, previousLayout=null) {
  if(previousLayout&&layoutMatchesImage(imageData,width,height,corners,previousLayout,quiz))return previousLayout;
  const standard=getSheetLayout(quiz.numQuestions,quiz.options);
  if(layoutMatchesImage(imageData,width,height,corners,standard,quiz))return standard;
  const project=createProjector(corners);
  // Measure printed circles on a rectified page instead of assuming a template version.
  const w=1056,h=1440,mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const p=project(x/w,y/h),px=Math.round(p.x),py=Math.round(p.y);
    if(px<0||px>=width||py<0||py>=height)continue;
    const k=(py*width+px)*4;
    mask[y*w+x]=imageData.data[k]*.299+imageData.data[k+1]*.587+imageData.data[k+2]*.114<150?1:0;
  }
  // Join one-pixel breaks caused by resampling thin printed circle outlines.
  const originalMask=mask.slice();
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++) {
    const k=y*w+x;
    if(originalMask[k]||originalMask[k-1]||originalMask[k+1]||originalMask[k-w]||originalMask[k+w])mask[k]=1;
  }
  const dark=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&mask[y*w+x]>0;
  // Fast path is allowed only when every expected printed perimeter is actually present.
  const standardMatches=Object.values(standard.questions).every(q=>quiz.options.every(opt=>{
    const c=q.options[opt],cx=c.u*w,cy=c.v*h,r=c.radius*w;let hits=0;
    for(let j=0;j<24;j++){const t=j*Math.PI/12;let hit=false;
      for(const f of [.8,.9,1,1.1,1.2])if(dark(Math.round(cx+Math.cos(t)*r*f),Math.round(cy+Math.sin(t)*r*f)))hit=true;
      if(hit)hits++;
    }
    return hits>=14;
  }));
  if(standardMatches)return standard;
  const circles=[];
  for(let seed=Math.floor(h*.18)*w;seed<Math.floor(h*.98)*w;seed++) {
    if(mask[seed]!==1)continue;
    let head=0,tail=1,minX=w,minY=h,maxX=0,maxY=0;queue[0]=seed;mask[seed]=2;
    while(head<tail) {
      const n=queue[head++],x=n%w,y=(n/w)|0;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const k of [x>0?n-1:-1,x<w-1?n+1:-1,y>0?n-w:-1,y<h-1?n+w:-1])if(k>=0&&mask[k]===1){mask[k]=2;queue[tail++]=k;}
    }
    const bw=maxX-minX+1,bh=maxY-minY+1,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    if(bw<12||bh<12||bw>65||bh>65||bw/bh<.8||bw/bh>1.25)continue;
    let hits=0;
    for(let j=0;j<24;j++){
      const t=j*Math.PI/12;
      let hit=false;
      for(const f of [.44,.46,.48,.50,.52,.54])if(dark(Math.round(cx+Math.cos(t)*bw*f),Math.round(cy+Math.sin(t)*bh*f)))hit=true;
      if(hit)hits++;
    }
    if(hits<18)continue;
    // Letter strokes and square text components cannot approximate the full circle perimeter.
    const cornerCount=[[.08,.08],[.92,.08],[.08,.92],[.92,.92]].filter(([u,v])=>dark(Math.round(minX+bw*u),Math.round(minY+bh*v))).length;
    if(cornerCount>1)continue;
    circles.push({x:cx,y:cy,r:Math.max(bw,bh)/2});
  }
  const unique=[];
  for(const c of circles.sort((a,b)=>b.r-a.r))if(!unique.some(p=>Math.hypot(p.x-c.x,p.y-c.y)<p.r*.6))unique.push(c);
  const layout=getSheetLayout(quiz.numQuestions,quiz.options);
  let matched=0;
  for(let col=0;col<layout.numColumns;col++) {
    const left=layout.numColumns===1?0:(.03+col*.94/layout.numColumns)*w;
    const right=layout.numColumns===1?w:(.03+(col+1)*.94/layout.numColumns)*w;
    const candidates=unique.filter(c=>c.x>left&&c.x<right).sort((a,b)=>a.y-b.y);
    const rows=[];
    for(const c of candidates){let row=rows.find(row=>Math.abs(row[0].y-c.y)<c.r*.65);if(!row){row=[];rows.push(row);}row.push(c);}
    const expected=Math.min(layout.questionsPerColumn,quiz.numQuestions-col*layout.questionsPerColumn);
    const xGroups=[];
    for(const c of candidates){let group=xGroups.find(g=>Math.abs(g[0].x-c.x)<c.r*.7);if(!group){group=[];xGroups.push(group);}group.push(c);}
    const axes=xGroups.filter(g=>g.length>=Math.max(1,expected*.5)).sort((a,b)=>a[0].x-b[0].x).slice(-quiz.options.length).map(g=>g.reduce((a,c)=>a+c.x,0)/g.length);
    const good=rows.map(row=>row.filter(c=>axes.some(x=>Math.abs(c.x-x)<c.r*.7))).filter(row=>row.length>=2).sort((a,b)=>a[0].y-b[0].y);
    if(axes.length!==quiz.options.length||good.length!==expected)throw new Error('The printed bubble grid could not be matched to this quiz. Check the question and choice counts, or use Align bubbles.');
    for(let row=0;row<expected;row++) {
      const q=col*layout.questionsPerColumn+row+1,info=layout.questions[q];
      const y=good[row].reduce((a,c)=>a+c.y,0)/good[row].length;
      const radius=good[row].reduce((a,c)=>a+c.r,0)/good[row].length;
      quiz.options.forEach((opt,i)=>{
        const found=good[row].find(c=>Math.abs(c.x-axes[i])<c.r*.7);
        const c=found||{x:axes[i],y,r:radius};
        if(!found){
          // A faint broken outline may be inferred only where its perimeter is visible.
          let hits=0;for(let j=0;j<24;j++){let hit=false;const t=j*Math.PI/12;for(const f of [.75,.9,1,1.1,1.2])if(dark(Math.round(c.x+Math.cos(t)*c.r*f),Math.round(c.y+Math.sin(t)*c.r*f)))hit=true;if(hit)hits++;}
          if(hits<16)throw new Error('Some bubble outlines are too faint. Upload a clearer photo or use Align bubbles.');
        }
        info.options[opt]={u:c.x/w,v:c.y/h,radius:c.r/w};matched++;
      });
      info.paperRef={u:(axes[0]-radius*1.65)/w,v:y/h};
    }
  }
  if(matched!==quiz.numQuestions*quiz.options.length)throw new Error('The bubble grid is incomplete.');
  return layout;
}

/**
 * Samples average luminance in a small rectangular patch.
 */
function samplePatchLuminance(data, width, height, centerX, centerY, radius = 5) {
  let sum = 0;
  let count = 0;
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(width - 1, Math.ceil(centerX + radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endY = Math.min(height - 1, Math.ceil(centerY + radius));

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      sum += lum;
      count++;
    }
  }

  return count > 0 ? sum / count : 255;
}

/**
 * Samples inner circular bubble area to calculate dark pixel fill ratio.
 * Uses an inner radius (72% of total bubble radius) to avoid picking up the outer printed border circle.
 */
function sampleBubbleFill(data, width, height, centerX, centerY, radius, bgLuminance) {
  let darkPixelCount = 0;
  let totalSampled = 0;
  let sumLuminance = 0;

  // Sample inner core of the bubble (avoiding border circle stroke)
  const innerRadius = Math.max(2, Math.floor(radius * 0.62));
  const rSquared = innerRadius * innerRadius;

  // Pixel considered dark if significantly darker than local white paper
  const darkThreshold = Math.max(35, bgLuminance * 0.72);

  for (let dy = -innerRadius; dy <= innerRadius; dy++) {
    const py = Math.floor(centerY + dy);
    if (py < 0 || py >= height) continue;

    for (let dx = -innerRadius; dx <= innerRadius; dx++) {
      const px = Math.floor(centerX + dx);
      if (px < 0 || px >= width) continue;

      if (dx * dx + dy * dy <= rSquared) {
        const idx = (py * width + px) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

        sumLuminance += lum;
        totalSampled++;

        if (lum < darkThreshold) {
          darkPixelCount++;
        }
      }
    }
  }

  if (totalSampled === 0) return { fillRatio: 0, avgLuminance: 255, contrast: 0 };

  const avgLuminance = sumLuminance / totalSampled;
  const fillRatio = darkPixelCount / totalSampled;
  const contrast = (bgLuminance - avgLuminance) / Math.max(1, bgLuminance);

  return {
    fillRatio,
    avgLuminance,
    contrast: Math.max(0, contrast)
  };
}

/**
 * Primary OMR Scanning Function.
 * Analyzes an image canvas against the quiz answer key.
 */
export function scanBubbleSheet(canvas, quiz, scanConfig = null) {
  if (Array.from({length: quiz.numQuestions}, (_, i) => quiz.answerKey[i+1]).some(a => !quiz.options.includes(a))) throw new Error("Complete the answer key before scanning.");
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = scanConfig?.imageData || ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const corners = scanConfig?.corners || detectCornerMarkers(imgData, width, height);
  const layout = scanConfig?.layout || detectBubbleLayout(imgData, width, height, corners, quiz, scanConfig?.previousLayout);
  const project=createProjector(corners);

  const markerSpanX = corners.tr.x - corners.tl.x;
  const markerSpanY = corners.bl.y - corners.tl.y;

  const answers = {};
  let totalScore = 0;
  const totalPossible = quiz.numQuestions * (quiz.pointsPerQuestion || 1);

  // Analyze each question
  for (let q = 1; q <= quiz.numQuestions; q++) {
    const qInfo = layout.questions[q];
    if (!qInfo) continue;

    // 1. Sample local paper background reference
    const paperPixel = project(qInfo.paperRef.u, qInfo.paperRef.v);
    const bgLuminance = samplePatchLuminance(data, width, height, paperPixel.x, paperPixel.y, 6);

    // 2. Measure fill metrics for each option A, B, C, D
    const optionMetrics = {};
    let maxScore = -1;
    let selectedOption = null;
    let optionList = [];

    quiz.options.forEach(opt => {
      const optCoord = qInfo.options[opt];
      const bubblePixel = project(optCoord.u, optCoord.v);
      const center = bubblePixel;
      const edgeX = project(optCoord.u + optCoord.radius, optCoord.v);
      const edgeY = project(optCoord.u, optCoord.v + optCoord.radius * (1200 * 0.88) / (1600 * 0.90));
      const pixelRadius = Math.min(Math.hypot(edgeX.x-center.x,edgeX.y-center.y),Math.hypot(edgeY.x-center.x,edgeY.y-center.y));

      const metrics = sampleBubbleFill(data, width, height, bubblePixel.x, bubblePixel.y, pixelRadius, bgLuminance);

      optionMetrics[opt] = {
        ...metrics,
        pixelX: bubblePixel.x,
        pixelY: bubblePixel.y,
        radius: pixelRadius
      };

      optionList.push({ opt, ...metrics });

      // Metric combines fill ratio (75%) and relative contrast (25%)
      const combinedScore = metrics.fillRatio * 0.75 + metrics.contrast * 0.25;
      if (combinedScore > maxScore) {
        maxScore = combinedScore;
        selectedOption = opt;
      }
    });

    // Sort by fill score descending
    optionList.sort((a, b) => (b.fillRatio * 0.75 + b.contrast * 0.25) - (a.fillRatio * 0.75 + a.contrast * 0.25));
    const highest = optionList[0];
    const second = optionList[1];

    // Detection decision:
    // With inner 72% sampling, empty bubbles have fillRatio < 0.10
    // Filled bubbles typically have fillRatio >= 0.20 (often 0.40 - 0.95)
    const FILLED_THRESHOLD = 0.36;
    const EMPTY_THRESHOLD = 0.22;

    let finalDetectedChoice = 'BLANK';
    let confidence = 0;

    if (highest.fillRatio >= FILLED_THRESHOLD || highest.contrast >= 0.38) {
      // Check if second highest is also filled (multi-bubble)
      if (second && second.fillRatio >= FILLED_THRESHOLD) {
        finalDetectedChoice = 'MULTI';
        confidence = 0.5;
      } else {
        finalDetectedChoice = highest.opt;
        confidence = Math.min(1, (highest.fillRatio - (second ? second.fillRatio : 0)) + 0.5);
      }
    } else if (highest.fillRatio > EMPTY_THRESHOLD && highest.contrast > 0.24) {
      finalDetectedChoice = highest.opt;
      confidence = 0.4;
    }

    const correctAnswer = quiz.answerKey[q] || null;
    const isCorrect = (correctAnswer !== null) && (finalDetectedChoice === correctAnswer);

    if (isCorrect) {
      totalScore += (quiz.pointsPerQuestion || 1);
    }

    answers[q] = {
      questionNumber: q,
      selected: finalDetectedChoice,
      correctAnswer,
      isCorrect,
      confidence: Math.round(confidence * 100),
      options: optionMetrics
    };
  }

  const gradeInfo = calculateGrade(totalScore, totalPossible);

  return {
    quizId: quiz.id,
    score: totalScore,
    totalPossible,
    percentage: gradeInfo.percentage,
    letterGrade: gradeInfo.letter,
    gradeColor: gradeInfo.color,
    answers,
    corners,
    layout,
    scannedAt: new Date().toISOString()
  };
}

/**
 * Draws Augmented Reality / grading feedback overlay directly onto a display canvas.
 */
export function drawGradingOverlay(canvas, scanResult, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !scanResult) return;

  // Draw detected corner bounding box
  if (scanResult.corners) {
    ctx.strokeStyle = '#38bdf8'; // Sky blue border guide
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(scanResult.corners.tl.x, scanResult.corners.tl.y);
    ctx.lineTo(scanResult.corners.tr.x, scanResult.corners.tr.y);
    ctx.lineTo(scanResult.corners.br.x, scanResult.corners.br.y);
    ctx.lineTo(scanResult.corners.bl.x, scanResult.corners.bl.y);
    ctx.closePath();
    ctx.stroke();
  }

  // Draw feedback for each question
  Object.values(scanResult.answers).forEach(qAns => {
    const isCorrect = qAns.isCorrect;
    const selected = qAns.selected;
    const correctOpt = qAns.correctAnswer;

    // Draw for each bubble
    Object.entries(qAns.options).forEach(([optKey, optData]) => {
      const { pixelX, pixelY, radius } = optData;

      if (selected === optKey) {
        if (isCorrect) {
          // Correct Answer: Vibrant Green Circle + Checkmark
          ctx.strokeStyle = '#10b981'; // Emerald 500
          ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(pixelX, pixelY, radius + 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Small Checkmark
          ctx.fillStyle = '#10b981';
          ctx.font = `bold ${Math.max(12, Math.floor(radius * 1.3))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', pixelX, pixelY);
        } else {
          // Wrong Answer: Red Circle + Cross
          ctx.strokeStyle = '#ef4444'; // Red 500
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(pixelX, pixelY, radius + 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Small X
          ctx.fillStyle = '#ef4444';
          ctx.font = `bold ${Math.max(12, Math.floor(radius * 1.3))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✗', pixelX, pixelY);
        }
      }

      // If student was wrong or blank, highlight the correct answer with an amber dashed ring
      if (!isCorrect && correctOpt === optKey) {
        ctx.strokeStyle = '#f59e0b'; // Amber 500
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(pixelX, pixelY, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Draw small label pointing out correct answer
        ctx.fillStyle = '#f59e0b';
        ctx.font = `bold ${Math.max(10, Math.floor(radius * 0.95))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(optKey, pixelX, pixelY - radius - 5);
      }
    });
  });
}
