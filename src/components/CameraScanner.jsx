import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  FlipHorizontal,
  Upload,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Save,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Lightbulb,
  Smartphone,
  ChevronRight,
  User,
  Zap
} from 'lucide-react';
import { LiveScanSession } from '../utils/liveScanSession';
import { getSheetLayout } from '../utils/sheetLayout';
import { calculateGrade } from '../types/quizModel';
import { scanBubbleSheet, drawGradingOverlay, detectCornerMarkers, inverseMapPoint, mapPoint } from '../utils/omrEngine';
import { playSuccessChime } from '../utils/audioFeedback';
import { generateSimulatedTestSheet } from '../utils/sheetGenerator';

export default function CameraScanner({
  quiz,
  onSaveSubmission,
  onNavigateToKey,
  onNavigateToPrint
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraPhotoRef = useRef(null);
  const viewfinderRef = useRef(null);

  // Canvas refs
  const hiddenCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  // Camera states
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraStarting,setCameraStarting]=useState(false);
  const isEmbedded=window.self!==window.top;
  const embedCameraMessage='This website embed blocks live camera access. Google Sites must allow the camera in every enclosing frame; QuickGrade cannot change that permission. Open the separately hosted QuickGrade HTTPS page directly for live scanning, or try Take sheet photo here.';
  const cameraPolicyAllows=()=> {
    try{const policy=document.permissionsPolicy||document.featurePolicy;return policy?.allowsFeature?policy.allowsFeature('camera'):null;}catch{return null;}
  };
  const cameraGeneration = useRef(0);
  const sourceImageRef = useRef(null);
  const stableScanRef = useRef({signature: '', count: 0});
  const savingRef = useRef(false);
  const [lightningMode,setLightningMode]=useState(false);
  const [lightningScore,setLightningScore]=useState(null);
  const lightningSessionRef=useRef(new LiveScanSession());
  useEffect(()=>{lightningSessionRef.current=new LiveScanSession();setLightningScore(null);},[lightningMode,quiz.id,hasCamera]);
  const [videoAspect,setVideoAspect]=useState(4/3);
  const [alignment,setAlignment]=useState(null);
  const [scanError, setScanError] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [isLiveScanning, setIsLiveScanning] = useState(true);
  const [liveStatus,setLiveStatus]=useState({stage:'off',message:'Start the camera to detect a sheet.',markerCount:0});
  const previewCanvasRef=useRef(null);
  const [cameraDevices,setCameraDevices]=useState([]);
  const [cameraDeviceId,setCameraDeviceId]=useState('');
  const [cameraName,setCameraName]=useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scan Result Modal / Review State
  const [scanResult, setScanResult] = useState(null);
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Keep the video visible before starting playback on Safari.
  const startCamera = useCallback(async () => {
    const generation=++cameraGeneration.current;
    setCameraError(null);setCameraStarting(true);
    setLiveStatus({stage:'starting',message:'Opening camera. Allow camera access if your browser asks.',markerCount:0});
    streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;
    setHasCamera(false);
    try {
      if(cameraPolicyAllows()===false)throw new Error(embedCameraMessage);
      if(!window.isSecureContext) throw new Error('This page is not a secure website, so live camera access is blocked. Open an HTTPS address in Safari, or use Take sheet photo.');
      if(!navigator.mediaDevices?.getUserMedia) throw new Error('This browser or file preview does not provide live camera access. Open the app as an HTTPS website in Safari, or use Take sheet photo.');
      let stream;
      try {
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(cameraDeviceId?{deviceId:{exact:cameraDeviceId}}:{facingMode:{ideal:facingMode}}),width:{ideal:1920},height:{ideal:1440}}});
      }catch(error){
        if(error.name!=='OverconstrainedError')throw error;
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facingMode}}});
      }
      if(generation!==cameraGeneration.current){stream.getTracks().forEach(t=>t.stop());return;}
      streamRef.current=stream;
      const video=videoRef.current;
      video.muted=true;video.playsInline=true;
      video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
      video.srcObject=stream;
      // Let React display the video before Safari attempts inline playback.
      await new Promise(resolve=>requestAnimationFrame(resolve));
      let playTimer;
      try {
        await Promise.race([video.play(),new Promise((_,reject)=>{playTimer=setTimeout(()=>reject(new Error('The camera did not start playing. Retry in Safari, or use Take sheet photo.')),10000);})]);
      }finally{clearTimeout(playTimer);}
      if(generation!==cameraGeneration.current){stream.getTracks().forEach(t=>t.stop());return;}
      setVideoAspect(video.videoWidth/video.videoHeight || 4/3);
      setHasCamera(true);
      const track=stream.getVideoTracks()[0];
      setCameraName(track.label&&track.label.length<60?track.label:'Camera');
      setLiveStatus({stage:'searching',message:'Looking for the four printed corner markers…',markerCount:0});
      try{setHasTorch(Boolean(track.getCapabilities?.().torch));}catch{setHasTorch(false);}
      setTorchOn(false);
      // Device listing is optional; its failure must never stop a working camera.
      try{
        const devices=await navigator.mediaDevices.enumerateDevices?.()||[];
        if(generation!==cameraGeneration.current)return;
        const cameras=devices.filter(d=>d.kind==='videoinput');setCameraDevices(cameras);
        const activeId=track.getSettings?.().deviceId;
        const activeName=cameras.find(d=>d.deviceId===activeId)?.label;
        if(activeName)setCameraName(activeName);
      }catch{setCameraDevices([]);}
    }catch(error){
      if(generation!==cameraGeneration.current)return;
      streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
      setHasCamera(false);
      const message=error.name==='NotAllowedError'&&isEmbedded?embedCameraMessage:error.name==='NotAllowedError'?'Camera access was denied or blocked by this browser. Open the HTTPS app in Safari, allow camera access in the website settings, and retry. You can also use Take sheet photo.':error.name==='NotReadableError'?'The camera is busy or unavailable. Close other camera apps and retry, or use Take sheet photo.':error.name==='NotFoundError'?'No available camera was found. Try Take sheet photo or Upload Photo.':error.message;
      setCameraError(message);setLiveStatus({stage:'error',message,markerCount:0});
    }finally{if(generation===cameraGeneration.current)setCameraStarting(false);}
  },[facingMode,cameraDeviceId]);
  useEffect(()=> {
    if(streamRef.current) startCamera();
    return ()=> {cameraGeneration.current++;streamRef.current?.getTracks().forEach(t=>t.stop());};
  },[startCamera]);

  // Flip camera between front and rear
  const toggleCameraFacing = () => {
    setCameraDeviceId('');
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Torch / Flashlight state
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const toggleTorch = async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        const nextTorch = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextTorch }]
        });
        setTorchOn(nextTorch);
      }
    } catch (e) {
      console.warn('Torch constraint error:', e);
    }
  };

  const showLightningScore=(result,source='live')=> {
    const answers=Object.values(result.answers);
    setLightningScore({score:result.score,totalPossible:result.totalPossible,percentage:result.percentage,
      blank:answers.filter(a=>a.selected==='BLANK').length,multi:answers.filter(a=>a.selected==='MULTI').length,
      uncertain:answers.filter(a=>!['BLANK','MULTI'].includes(a.selected)&&a.confidence<70).length,source,scannedAt:result.scannedAt});
    if(soundEnabled)playSuccessChime(result.percentage===100);
  };

  /**
   * Run OMR scanning on a given canvas element and present results.
   */
  const processCanvasAndGrade = (sourceCanvas, guidedBounds = null, customStudent = null) => {
    setScanError('');
    if(lightningMode){
      try{showLightningScore(guidedBounds?.result||scanBubbleSheet(sourceCanvas,quiz,guidedBounds),customStudent?'demo':'photo');}
      catch(err){setScanError(err.message);}
      return;
    }
    setIsProcessing(true);
    savingRef.current = false;
    try {
      const original=document.createElement('canvas');
      original.width=sourceCanvas.width;original.height=sourceCanvas.height;
      original.getContext('2d').drawImage(sourceCanvas,0,0);
      sourceImageRef.current=original;
      const result = guidedBounds?.result||scanBubbleSheet(sourceCanvas, quiz, guidedBounds);

      // Create high-res graded overlay snapshot
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = sourceCanvas.width;
      overlayCanvas.height = sourceCanvas.height;
      const ctx = overlayCanvas.getContext('2d');
      ctx.drawImage(sourceCanvas, 0, 0);
      drawGradingOverlay(overlayCanvas, result);

      const snapshotUrl = overlayCanvas.toDataURL('image/jpeg', 0.85);

      // Sound & Celebration
      const isPerfect = result.percentage === 100;
      if (soundEnabled) {
        playSuccessChime(isPerfect);
      }


      const nextNum = (quiz.submissions?.length || 0) + 1;
      setStudentName(customStudent?.name || '');
      setStudentId(customStudent?.id || '');
      setScanResult(result);
      setCapturedImageDataUrl(snapshotUrl);
    } catch (err) {
      console.error('Grading error:', err);
      setScanError(err.message || 'Could not read this image. Use a clear, upright QuickGrade sheet photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Capture a single frame from the live video feed.
   */
  const handleCaptureSnapshot = useCallback(() => {
    if (!videoRef.current || !hiddenCanvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) {setScanError('The camera is still loading. Wait for the live image, then capture again.');return;}

    const canvas = hiddenCanvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    processCanvasAndGrade(canvas);
  }, [quiz, soundEnabled,lightningMode]);

  // Analyze one frame at a time and leave time between checks for video and touch input.
  useEffect(() => {
    if (!hasCamera || scanResult || isProcessing || alignment) {
      stableScanRef.current={signature:'',count:0};return;
    }
    let stopped=false,timer,previousLayout=null,lastVideoTime=-1;
    const analyze=()=> {
      const start=performance.now();
      try {
        const video=videoRef.current,canvas=hiddenCanvasRef.current,overlay=previewCanvasRef.current;
        if(stopped||document.hidden||!video||video.readyState<2||video.currentTime===lastVideoTime)return;
        lastVideoTime=video.currentTime;
        const scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));
        const width=Math.round(video.videoWidth*scale),height=Math.round(video.videoHeight*scale);
        if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;previousLayout=null;}
        const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(video,0,0,width,height);
        const imageData=context.getImageData(0,0,width,height);
        const drawPreview=(corners,answers=null,candidates=[])=> {
          if(!overlay)return;
          if(overlay.width!==width||overlay.height!==height){overlay.width=width;overlay.height=height;}
          const ctx=overlay.getContext('2d');ctx.clearRect(0,0,width,height);
          ctx.strokeStyle='#34d399';ctx.lineWidth=Math.max(2,width/400);
          for(const p of corners?Object.values(corners):candidates){ctx.beginPath();ctx.arc(p.x,p.y,Math.max(6,width/100),0,Math.PI*2);ctx.stroke();}
          if(corners){ctx.beginPath();ctx.moveTo(corners.tl.x,corners.tl.y);for(const p of [corners.tr,corners.br,corners.bl])ctx.lineTo(p.x,p.y);ctx.closePath();ctx.stroke();}
          if(answers)for(const a of Object.values(answers))for(const o of Object.values(a.options)){ctx.beginPath();ctx.arc(o.pixelX,o.pixelY,o.radius,0,Math.PI*2);ctx.stroke();}
        };
        let corners;
        try {
          corners=detectCornerMarkers(imageData,width,height);drawPreview(corners);
        }catch(error){
          stableScanRef.current={signature:'',count:0};lightningSessionRef.current.miss();
          drawPreview(null,null,error.markerCandidates||[]);
          setLiveStatus({stage:'searching',markerCount:Math.min(4,error.markerCount||0),message:error.message});return;
        }
        try {
          // Read pixels once; an older grid is re-used only after its outlines pass validation.
          const quick=scanBubbleSheet(canvas,quiz,{corners,imageData,previousLayout});previousLayout=quick.layout;
          drawPreview(corners,quick.answers);
          const signature=Object.values(quick.answers).map(a=>a.selected).join(',');
          const prev=stableScanRef.current;
          const moved=prev.corners&&Object.keys(corners).some(k=>Math.hypot(corners[k].x-prev.corners[k].x,corners[k].y-prev.corners[k].y)>width*.012);
          const count=!moved&&prev.signature===signature?prev.count+1:1;
          stableScanRef.current={signature,count,corners};
          if(lightningMode){
            if(lightningSessionRef.current.update(signature,corners,width,performance.now()))showLightningScore(quick);
            setLiveStatus({stage:'ready',markerCount:4,message:count>=2?'Sheet scored. Point at the next sheet; briefly move this sheet out of view if the answers are identical.':'Sheet detected. Reading answers…'});
          }else{
            setLiveStatus({stage:'ready',markerCount:4,message:isLiveScanning?`Sheet and ${quiz.numQuestions} answer rows detected. Hold still (${Math.min(count,2)}/2)…`:`Sheet detected: ${quiz.numQuestions} answer rows. Capture to review the grade.`});
            // Grade the exact frame that passed stability, without detecting the same page again.
            if(isLiveScanning&&count>=2)processCanvasAndGrade(canvas,{result:quick});
          }
        }catch(error){
          stableScanRef.current={signature:'',count:0};lightningSessionRef.current.miss();
          setLiveStatus({stage:'grid',markerCount:4,message:'Page detected. '+error.message});
        }
      }finally{
        if(!stopped)timer=setTimeout(analyze,Math.max(120,200-(performance.now()-start)));
      }
    };
    analyze();
    return ()=>{stopped=true;clearTimeout(timer);};
  },[isLiveScanning,lightningMode,hasCamera,scanResult,isProcessing,alignment,quiz,soundEnabled]);

  /**
   * Handle file upload (photo from camera roll or file picker)
   */
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {setScanError('Select a JPEG, PNG, or another image supported by your browser.'); return;}
    const reader = new FileReader();
    reader.onerror=()=>setScanError('This file could not be read. Try another photo.');
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = hiddenCanvasRef.current;
        const scale=Math.min(1,2400/Math.max(img.width,img.height));
        canvas.width = Math.round(img.width*scale);
        canvas.height = Math.round(img.height*scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0,canvas.width,canvas.height);
        processCanvasAndGrade(canvas);
      };
      img.onerror=()=>setScanError("This image format could not be opened. Export the photo as JPEG or PNG and retry.");
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  /**
   * 1-Click Simulation: generate a realistic student sheet and auto-grade it instantly!
   */
  const handleSimulateScan = (targetScore = null) => {
    const nextNum = (quiz.submissions?.length || 0) + 1;
    const sampleNames = ['Maya Lin', 'Liam O’Connor', 'Elena Rostova', 'Kofi Mensah', 'Zara Patel', 'Noah Kim'];
    const randomName = sampleNames[(nextNum - 1) % sampleNames.length];
    const randomId = `10${Math.floor(10 + Math.random() * 89)}`;

    const { canvas } = generateSimulatedTestSheet(quiz, randomName, targetScore);
    processCanvasAndGrade(canvas, null, { name: randomName, id: randomId });
  };

  /**
   * Save submission to quiz and reset to scan next
   */
  const handleSaveAndScanNext = () => {
    if (!scanResult || savingRef.current) return;
    if (!studentName.trim()) {setScanError('Enter the student name before saving.');return;}
    savingRef.current=true;
    const submission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      quizId: quiz.id,
      studentName: studentName.trim() || 'Anonymous Student',
      studentId: studentId.trim() || 'N/A',
      score: scanResult.score,
      totalPossible: scanResult.totalPossible,
      percentage: scanResult.percentage,
      letterGrade: scanResult.letterGrade,
      answers: scanResult.answers,
      imageUrl: capturedImageDataUrl,
      scannedAt: new Date().toISOString()
    };

    onSaveSubmission(submission);
    setScanResult(null);
    setCapturedImageDataUrl(null);
  };

  // Toggle answer override in review modal
  const handleToggleAnswer = (qNum, newChoice) => {
    if (!scanResult) return;
    const currentAns = scanResult.answers[qNum];
    const isCorrect = (newChoice === quiz.answerKey[qNum]);
    const scoreDiff = (isCorrect ? 1 : 0) - (currentAns.isCorrect ? 1 : 0);
    const newScore = Math.max(0, scanResult.score + scoreDiff * (quiz.pointsPerQuestion || 1));
    const grade=calculateGrade(newScore,scanResult.totalPossible);
    const updated={...scanResult,score:newScore,percentage:grade.percentage,letterGrade:grade.letter,gradeColor:grade.color,
      answers:{...scanResult.answers,[qNum]:{...currentAns,selected:newChoice,isCorrect,confidence:100,manuallyReviewed:true}}};
    setScanResult(updated);
    const original=sourceImageRef.current;
    if(original) {
      const overlay=document.createElement('canvas');overlay.width=original.width;overlay.height=original.height;
      overlay.getContext('2d').drawImage(original,0,0);drawGradingOverlay(overlay,updated);
      setCapturedImageDataUrl(overlay.toDataURL('image/jpeg',.72));
    }
  };

  const beginAlignment=()=> {
    const canvas=sourceImageRef.current;
    if(!canvas){setScanError('Upload or capture a sheet first, then select Align bubbles.');return;}
    try {
      const ctx=canvas.getContext('2d');
      const corners=detectCornerMarkers(ctx.getImageData(0,0,canvas.width,canvas.height),canvas.width,canvas.height);
      const layout=getSheetLayout(quiz.numQuestions,quiz.options),steps=[];
      for(let col=0;col<layout.numColumns;col++) {
        const first=col*layout.questionsPerColumn+1,last=Math.min(quiz.numQuestions,(col+1)*layout.questionsPerColumn);
        if(first>quiz.numQuestions)continue;
        steps.push({col,kind:'first',label:`Question ${first}, option A`},{col,kind:'across',label:`Question ${first}, option ${quiz.options.at(-1)}`});
        if(last!==first)steps.push({col,kind:'last',label:`Question ${last}, option A`});
      }
      setScanResult(null);setIsLiveScanning(false);
      setAlignment({corners,layout,steps,points:[],url:canvas.toDataURL('image/jpeg',.85)});
    }catch(err){setScanError(err.message);}
  };
  const handleAlignmentPoint=e=> {
    const rect=e.currentTarget.getBoundingClientRect(),canvas=sourceImageRef.current;
    const x=(e.clientX-rect.left)/rect.width*canvas.width,y=(e.clientY-rect.top)/rect.height*canvas.height;
    const point=inverseMapPoint(x,y,alignment.corners);
    const points=[...alignment.points,point];
    if(points.length<alignment.steps.length){setAlignment({...alignment,points});return;}
    const layout=alignment.layout;
    for(let col=0;col<layout.numColumns;col++) {
      const get=kind=>points[alignment.steps.findIndex(step=>step.col===col&&step.kind===kind)];
      const a=get('first'),b=get('across'),c=get('last')||a;
      const first=col*layout.questionsPerColumn+1,last=Math.min(quiz.numQuestions,(col+1)*layout.questionsPerColumn);
      if(first>quiz.numQuestions)continue;
      if(b.u-a.u<.05||(last>first&&c.v-a.v<.02)){setScanError('Those points do not form a grid. Align the first row from left to right and the final row below it.');setAlignment(null);return;}
      for(let q=first;q<=last;q++) {
        const f=last===first?0:(q-first)/(last-first),info=layout.questions[q];
        const radius=Math.min((b.u-a.u)/(quiz.options.length-1)*.17,last===first?.022:(c.v-a.v)/(last-first)*1.36*.30);
        quiz.options.forEach((opt,i)=> {const t=i/(quiz.options.length-1);info.options[opt]={u:a.u+t*(b.u-a.u)+f*(c.u-a.u),v:a.v+t*(b.v-a.v)+f*(c.v-a.v),radius};});
        info.paperRef={u:a.u+f*(c.u-a.u)-radius*1.7,v:a.v+f*(c.v-a.v)};
      }
    }
    setAlignment(null);processCanvasAndGrade(canvas,{corners:alignment.corners,layout});
  };

  const keyComplete=Array.from({length:quiz.numQuestions},(_,i)=>quiz.answerKey[i+1]).every(a=>quiz.options.includes(a));
  if(!keyComplete) return <div className="max-w-xl mx-auto p-8"><h1 className="text-2xl font-bold mb-3">Complete the answer key first</h1><p className="text-slate-600 mb-6">Set a correct answer for every question before grading student sheets.</p><button className="px-5 py-3 rounded-xl bg-indigo-600 text-white" onClick={onNavigateToKey}>Return to answer key</button></div>;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800 flex flex-col relative pb-12">
      {/* Hidden processing canvas */}
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"

        onChange={handleFileUpload}
        className="hidden"
      />
      <input ref={cameraPhotoRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" aria-label="Take sheet photo with device camera" />

      {/* Top Floating Control Bar */}
      <div className="max-w-4xl w-full mx-auto px-4 pt-4 pb-2 flex flex-wrap gap-3 items-center justify-between z-20">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${hasCamera?"bg-emerald-600":"bg-slate-400"}`} />
            OMR Camera Scanner
          </h2>
          <p className="text-xs text-slate-500">
            Scanning for: <strong className="text-slate-800">{quiz.title}</strong> ({quiz.numQuestions} Qs)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Torch toggle */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-xl border transition shadow-xs ${
                torchOn
                  ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title={torchOn ? 'Turn Flash Off' : 'Turn Flash On'}
            >
              <Zap className="w-4 h-4 fill-current" />
            </button>
          )}

          <button onClick={()=>{setLightningMode(v=>!v);setScanError('');}} aria-pressed={lightningMode}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${lightningMode?'bg-indigo-600 text-white border-indigo-600':'bg-white text-indigo-700 border-slate-300 hover:bg-indigo-50'}`}>
            <Zap className="w-4 h-4" />Lightning mode
          </button>
          {/* Auto-scan mode toggle */}
          {!lightningMode&&<button
            onClick={() => setIsLiveScanning(!isLiveScanning)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-xs ${
              isLiveScanning
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            aria-label={isLiveScanning ? 'Pause auto-capture' : 'Enable auto-capture'}
            title="Automatically capture a steady sheet for review"
          >
            <Play className={`w-3.5 h-3.5 ${isLiveScanning ? 'fill-emerald-600 text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">{isLiveScanning ? 'Pause auto-capture' : 'Enable auto-capture'}</span>
          </button>}

          {/* Audio toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-xs"
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Camera flip */}
          <button
            onClick={toggleCameraFacing}
            className="flex items-center p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-xs"
            aria-label="Switch camera"
            title="Switch camera"
          >
            <FlipHorizontal className="w-4 h-4" /><span className="ml-1 text-xs">Switch camera</span>
          </button>

          <button onClick={()=>cameraPhotoRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"><Camera className="w-4 h-4" />Take sheet photo</button>
          {/* Upload photo */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Upload Photo</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto px-4 py-2 text-sm text-slate-600">
        {isEmbedded&&<div className="mb-3 p-3 rounded-xl bg-amber-50 text-amber-900" role="note"><strong>Running inside a website embed.</strong> Live camera access depends on the enclosing website’s permissions. If Start Camera is blocked, open the independently hosted QuickGrade page directly. Take sheet photo may remain available here.</div>}
        {!lightningMode&&<><p>On iPhone, open an HTTPS address in Safari for live scanning. Take sheet photo opens the device camera for a one-photo scan.</p>
        <p className="mt-1">Use a sheet printed from Bubble Sheets. Only rows 1–{quiz.numQuestions} are graded. Keep it upright, flat, evenly lit, with all four black corner markers visible. Photos stay on this device.</p></>}
        {scanError && <p role="alert" className="mt-2 text-rose-700 font-semibold">{scanError}</p>}
        {!lightningMode&&<button className="mt-2 text-indigo-700 font-semibold underline" onClick={beginAlignment}>Align bubbles on last image</button>}
        {lightningMode&&<p className="mt-2 font-semibold text-indigo-800">Show all four markers on a printed QuickGrade sheet. Point at the next sheet after each score. Nothing is saved in Lightning mode.</p>}
      </div>
      <div className="max-w-4xl w-full mx-auto px-4 mb-2">
        <div role="status" aria-live="polite" className={`p-3 rounded-xl text-sm ${liveStatus.stage==='ready'?'bg-emerald-50 text-emerald-900':'bg-white text-slate-700'}`}>
          <strong>{hasCamera?`Markers: ${liveStatus.markerCount}/4 · `:''}</strong>{liveStatus.message}
          {hasCamera&&<p className="mt-1 text-xs">Using {cameraName}. {lightningMode?'Lightning scanning is on.':isLiveScanning?'Auto-capture is on.':'Auto-capture is paused; live detection stays on.'}</p>}
        </div>
        {cameraDevices.length>1&&<label className="block mt-2 text-sm text-slate-700">Camera <select className="ml-2 rounded-lg border border-slate-300 px-2 py-1 max-w-full" value={cameraDeviceId||streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId||''} onChange={e=>setCameraDeviceId(e.target.value)}>{cameraDevices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`Camera ${i+1}`}</option>)}</select></label>}
      </div>
      {lightningMode&&<div className="max-w-4xl w-full mx-auto px-4 mb-2">
        <div role="status" aria-live="polite" aria-atomic="true" className="rounded-xl bg-indigo-950 text-white p-4 sm:p-5" data-testid="lightning-score" data-scored-at={lightningScore?.scannedAt}>
          {lightningScore?<>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 className="text-2xl sm:text-3xl font-bold">{lightningScore.source==='demo'?'Demo score':'Lightning score'}: {lightningScore.score} / {lightningScore.totalPossible}</h3>
              <span className="text-xl font-semibold">{lightningScore.percentage}%</span>
            </div>
            <p className="mt-1 text-sm text-indigo-100">{lightningScore.source==='live'?'Last sheet scored · Camera stays live':'Photo scored · Ready for another sheet'}</p>
            {(lightningScore.blank+lightningScore.multi+lightningScore.uncertain)>0&&<p className="mt-2 text-sm text-amber-200">{lightningScore.blank} blank · {lightningScore.multi} multiple marks · {lightningScore.uncertain} faint answers. Blank and multiple marks receive zero points. Use review mode to check uncertain readings.</p>}
          </>:<p className="font-semibold">Ready for your first sheet. Show all four corner markers.</p>}
        </div>
      </div>}
      {/* Main Camera Viewport Area */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-6">
        <div style={{aspectRatio:hasCamera?videoAspect:4/3}} className="relative w-full max-w-3xl bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border-4 border-white flex items-center justify-center">

          {/* Live Video */}
          <video
              ref={videoRef}
              onLoadedMetadata={e=>setVideoAspect(e.currentTarget.videoWidth/e.currentTarget.videoHeight||4/3)}
              onResize={e=>setVideoAspect(e.currentTarget.videoWidth/e.currentTarget.videoHeight||4/3)}
              playsInline
              autoPlay
              muted
              className={`w-full h-full object-contain ${hasCamera || cameraStarting ? "" : "hidden"}`}
            />
          {!hasCamera && !cameraStarting && (
            <div className="p-6 text-center max-w-sm">
              <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">Camera Inactive</h3>
              <p className="text-xs text-slate-400 mb-4">
                {cameraError || 'Start your camera or upload a sheet photo. No images are sent to a server.'}
              </p>
              <div className="flex flex-col gap-2">
                <button disabled={cameraStarting} onClick={startCamera} className="px-4 py-2.5 rounded-xl bg-emerald-700 text-white font-semibold text-sm">{cameraError ? 'Retry Camera' : 'Start Camera'}</button>
                <button onClick={()=>cameraPhotoRef.current?.click()} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm">Take sheet photo</button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                >
                  Upload Bubble Sheet Photo
                </button>
                <button
                  onClick={() => handleSimulateScan(Math.round(quiz.numQuestions * 0.9))}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs transition"
                >
                  Test with Virtual Simulated Paper
                </button>
              </div>
            </div>
          )}

          <canvas ref={previewCanvasRef} aria-label="Detected sheet and bubble positions" className={`absolute inset-0 w-full h-full pointer-events-none ${hasCamera?"":"hidden"}`} />
          {cameraStarting&&<div className="absolute bottom-4 left-4 right-4 rounded-xl bg-slate-900/90 text-white p-3 text-sm text-center">Opening camera… Allow access when prompted.</div>}
          {/* Processing Spinner Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center z-30">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
              <p className="text-sm font-bold text-white">Analyzing Optical Marks...</p>
              <p className="text-xs text-slate-400 mt-1">Comparing bubbles against Answer Key</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Action Panel */}
      <div className="max-w-xl w-full mx-auto px-4 z-20 flex flex-col items-center gap-3">
        {/* Shutter Capture Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleSimulateScan(quiz.numQuestions)}
            title="Generate a 100% test sheet to test grading immediately"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Test Demo Paper</span>
          </button>

          {/* Big Circular Shutter Button */}
          <button
            onClick={handleCaptureSnapshot}
            aria-label={lightningMode?"Read score now":"Capture and grade sheet"}
            disabled={!hasCamera || isProcessing}
            className="w-18 h-18 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 p-1.5 shadow-xl shadow-emerald-500/25 hover:scale-105 active:scale-95 transition transform disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="w-full h-full rounded-full border-2 border-white flex items-center justify-center bg-black/10">
              <Camera className="w-7 h-7 text-white fill-white/20" />
            </div>
          </button>

          <button
            onClick={() => handleSimulateScan(Math.round(quiz.numQuestions * 0.7))}
            title="Generate a 70% test sheet to test mistakes and correction indicators"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-sm transition"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Simulate Mistakes</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500 text-center">
          {lightningMode?<>Scores appear automatically while the camera stays live. Turn off Lightning mode to review and save a grade.</>:<>Tap the big button to snap and grade, or use <strong>Test Demo Paper</strong> to test the scanner right on your screen!</>}
        </p>
      </div>

      {alignment && <div className="fixed inset-0 bg-slate-950/70 z-50 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl p-5">
          <h2 className="text-xl font-bold">Align bubbles</h2>
          <p className="my-3 text-slate-700">Tap the center of <strong>{alignment.steps[alignment.points.length].label}</strong>. Point {alignment.points.length+1} of {alignment.steps.length}. These points locate the grid on this image.</p>
          <div className="flex gap-3 mb-3"><button onClick={()=>setAlignment(null)} className="px-3 py-2 rounded-lg bg-slate-100">Cancel alignment</button><button disabled={!alignment.points.length} onClick={()=>setAlignment({...alignment,points:alignment.points.slice(0,-1)})} className="px-3 py-2 rounded-lg bg-slate-100">Undo point</button></div>
          <div className="relative"><img src={alignment.url} alt="Sheet to align; tap the requested bubble center" onClick={handleAlignmentPoint} className="block w-full h-auto cursor-crosshair" />
          {alignment.points.map((p,i)=>{const canvas=sourceImageRef.current;const c=alignment.corners;const pos=mapPoint(p.u,p.v,c);return <span key={i} className="absolute w-4 h-4 rounded-full border-2 border-emerald-700 bg-emerald-100/50 pointer-events-none" style={{left:`${pos.x/canvas.width*100}%`,top:`${pos.y/canvas.height*100}%`,transform:'translate(-50%,-50%)'}}/>;})}</div>
        </div>
      </div>}

      {/* ================= RESULT & AUTO-CORRECTION MODAL ================= */}
      {scanResult && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200 text-slate-800">

            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${
                  scanResult.percentage >= 80
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : scanResult.percentage >= 60
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {scanResult.letterGrade}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    Score: {scanResult.score} / {scanResult.totalPossible}
                    <span className="text-sm font-semibold text-slate-500">({scanResult.percentage}%)</span>
                  </h3>
<p className="text-xs text-slate-500">Review detected answers before saving. Blank or multiple marks receive zero points.</p>
                  <button className="mt-1 text-sm text-indigo-700 font-semibold underline" onClick={beginAlignment}>Align bubbles</button>
                </div>
              </div>

              <button
                onClick={() => setScanResult(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto">

              {/* Left Column: Scanned Paper with AR Feedback Overlay */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Graded Optical Overlay
                </span>
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black aspect-[3/4] relative shadow-inner">
                  {capturedImageDataUrl && (
                    <img
                      src={capturedImageDataUrl}
                      alt="Scanned Sheet with Overlay"
                      className="w-full h-full object-contain"
                    />
                  )}
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-[11px] text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                    </span>
                    <span className="flex items-center gap-1 text-rose-400 font-semibold">
                      <XCircle className="w-3.5 h-3.5" /> Incorrect
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      Correct Key
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Student Details & Question Breakdown */}
              <div className="flex flex-col">
                {/* Student Info Inputs */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Student Name
                      </label>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="e.g. Maya Lin"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Student ID / Roll #
                      </label>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="e.g. 101"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Question Breakdown List */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Answer Breakdown (Tap to override)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {Object.values(scanResult.answers).filter(a => a.isCorrect).length} of {quiz.numQuestions} correct
                    </span>
                  </div>

                  {scanError && <p role="alert" className="text-sm text-rose-700 mb-2">{scanError}</p>}
                  <p className="text-xs text-slate-600 mb-2">{Object.values(scanResult.answers).filter(a=>a.confidence<70 || ['BLANK','MULTI'].includes(a.selected)).length} answers need review. Use the buttons to correct a reading.</p>
                  <div className="flex-1 overflow-y-auto max-h-56 pr-1 space-y-1.5">
                    {Object.values(scanResult.answers).map(ans => {
                      const q = ans.questionNumber;
                      return (
                        <div
                          key={q}
                          className={`px-3 py-2 rounded-xl border flex flex-wrap gap-2 items-center justify-between text-xs transition ${
                            ans.isCorrect
                              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                              : ans.selected === 'BLANK'
                              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                              : 'bg-rose-50/80 border-rose-200 text-rose-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700 w-5">Q{q}</span>
                            <span>Student: <strong className="font-bold">{ans.selected}</strong></span>
                            {!ans.isCorrect && (
                              <span className="text-slate-500">(Key: <strong className="text-emerald-700 font-bold">{ans.correctAnswer}</strong>)</span>
                            )}
                          </div>

                          {/* Quick Override Buttons */}
                          <div className="flex items-center gap-1">
                            {[...quiz.options, 'BLANK', 'MULTI'].map(opt => (
                              <button
                                key={opt}
                                onClick={() => handleToggleAnswer(q, opt)}
                                aria-label={`Question ${q}: set ${opt}`}
                                className={`min-w-6 h-8 px-1 rounded-md font-bold text-[11px] transition ${
                                  ans.selected === opt
                                    ? ans.isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-rose-600 text-white'
                                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer / Save Buttons */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setScanResult(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                  >
                    Discard & Rescan
                  </button>

                  <button
                    disabled={!studentName.trim()}
                    onClick={handleSaveAndScanNext}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition transform active:scale-98"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save & Scan Next Student</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
