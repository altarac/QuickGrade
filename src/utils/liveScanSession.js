// A score is shown after two matching, steady frames. Holding a sheet never repeats the chime.
// The next sheet can have the same answers: a brief gap or a clear move re-arms the scanner.
export class LiveScanSession {
  constructor(){this.stable=null;this.published=null;this.misses=0;}
  miss(){this.stable=null;if(++this.misses>=2)this.published=null;}
  update(signature,corners,width,time){
    this.misses=0;
    const distance=(a,b)=>Math.max(...Object.keys(a).map(k=>Math.hypot(a[k].x-b[k].x,a[k].y-b[k].y)));
    const same=this.stable?.signature===signature&&distance(corners,this.stable.corners)<=width*.012;
    this.stable=same?{...this.stable,corners,count:this.stable.count+1}:{signature,corners,count:1,since:time};
    const ready=this.stable.count>=2&&time-this.stable.since>=140;
    const changed=!this.published||this.published.signature!==signature||distance(corners,this.published.corners)>width*.08;
    if(!ready||!changed)return false;
    this.published={signature,corners};return true;
  }
}
