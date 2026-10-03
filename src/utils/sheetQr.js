import {SHEET_QR_ROWS} from './sheetQrData.js';

// Four empty modules on every edge form the QR quiet zone. Draw on integer pixels.
export function drawSheetQr(ctx,x,y,size) {
  const unit=size/(SHEET_QR_ROWS.length+8);
  ctx.save();ctx.fillStyle='#fff';ctx.fillRect(x,y,size,size);ctx.fillStyle='#000';
  for(let row=0;row<SHEET_QR_ROWS.length;row++)for(let col=0;col<SHEET_QR_ROWS.length;col++) {
    if(SHEET_QR_ROWS[row][col]!=='1')continue;
    const left=Math.round(x+(col+4)*unit),top=Math.round(y+(row+4)*unit);
    const right=Math.round(x+(col+5)*unit),bottom=Math.round(y+(row+5)*unit);
    ctx.fillRect(left,top,right-left,bottom-top);
  }
  ctx.restore();
}
