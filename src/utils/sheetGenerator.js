// Bubble Sheet Canvas Generator
// Generates high-resolution printable sheets and simulated test sheets with 100% coordinate fidelity.

import { getSheetLayout, CORNER_MARKER_RELATIVE_SIZE } from './sheetLayout.js';
import { mapPoint } from './omrEngine.js';

/**
 * Draws a standardized printable bubble sheet onto a canvas.
 * Uses exact fiducial mapping so drawn bubbles match OMR scanner sampling pixels 1:1.
 */
export function drawBubbleSheetToCanvas(canvas, quiz, options = {}) {
  const width = canvas.width || 1200;
  const height = canvas.height || 1600;
  const ctx = canvas.getContext('2d');

  const {
    studentName = '',
    studentId = '',
    date = new Date().toLocaleDateString(),
    filledAnswers = {} // e.g. { 1: 'A', 2: 'C', ... }
  } = options;

  const layout = getSheetLayout(quiz.numQuestions, quiz.options);

  // 1. Crisp white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. Define the 4 Corner Alignment Fiducial Anchors on the page
  const marginX = width * 0.06;
  const marginY = height * 0.05;
  const corners = {
    tl: { x: marginX, y: marginY },
    tr: { x: width - marginX, y: marginY },
    bl: { x: marginX, y: height - marginY },
    br: { x: width - marginX, y: height - marginY }
  };

  const markerSpanX = corners.tr.x - corners.tl.x;
  const markerSpanY = corners.bl.y - corners.tl.y;
  const markerSize = Math.round(markerSpanX * CORNER_MARKER_RELATIVE_SIZE); // ~55px

  // Draw 4 distinct solid black corner squares with high contrast
  [corners.tl, corners.tr, corners.bl, corners.br].forEach(pos => {
    // Solid black outer square
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(pos.x - markerSize / 2, pos.y - markerSize / 2, markerSize, markerSize);

    // Inner white square
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pos.x - markerSize * 0.22, pos.y - markerSize * 0.22, markerSize * 0.44, markerSize * 0.44);

    // Center black dot
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, markerSize * 0.12, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Header Section (positioned via mapPoint)
  const titlePos = mapPoint(layout.header.title.u, layout.header.title.v, corners);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(quiz.title || 'Multiple Choice Quiz', titlePos.x, titlePos.y, markerSpanX * 0.59);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`OMR FORM • ${quiz.numQuestions} QUESTIONS • CHOICES (${quiz.options.join('-')})`, titlePos.x, titlePos.y + 32);

  // Instructions Box
  const instrPos = mapPoint(layout.header.instructions.u, layout.header.instructions.v, corners);
  const instrW = markerSpanX * 0.31;
  const instrH = 58;

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(instrPos.x, instrPos.y, instrW, instrH);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('INSTRUCTIONS:', instrPos.x + 8, instrPos.y + 8);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('• Use dark pen or pencil', instrPos.x + 8, instrPos.y + 24);
  ctx.fillText('• Fill completely: ●', instrPos.x + 8, instrPos.y + 38);

  // Student Fields
  const namePos = mapPoint(layout.header.nameField.u, layout.header.nameField.v, corners);
  const idPos = mapPoint(layout.header.idField.u, layout.header.idField.v, corners);
  const datePos = mapPoint(layout.header.dateField.u, layout.header.dateField.v, corners);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillText('NAME:', namePos.x, namePos.y);
  ctx.fillText('ID #:', idPos.x, idPos.y);
  ctx.fillText('DATE:', datePos.x, datePos.y);

  // Underlines for fields
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;

  // Name underline
  ctx.beginPath();
  ctx.moveTo(namePos.x + 50, namePos.y + 6);
  ctx.lineTo(idPos.x - 15, namePos.y + 6);
  ctx.stroke();

  if (studentName) {
    ctx.fillStyle = '#1e293b';
    ctx.font = 'italic 16px "Comic Sans MS", cursive, sans-serif';
    ctx.fillText(studentName, namePos.x + 55, namePos.y);
  }

  // ID underline
  ctx.beginPath();
  ctx.moveTo(idPos.x + 40, idPos.y + 6);
  ctx.lineTo(datePos.x - 15, idPos.y + 6);
  ctx.stroke();

  if (studentId) {
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(studentId, idPos.x + 45, idPos.y);
  }

  // Date underline
  ctx.beginPath();
  ctx.moveTo(datePos.x + 48, datePos.y + 6);
  ctx.lineTo(corners.tr.x - 10, datePos.y + 6);
  ctx.stroke();

  if (date) {
    ctx.fillStyle = '#1e293b';
    ctx.font = '13px sans-serif';
    ctx.fillText(date, datePos.x + 52, datePos.y);
  }

  // Divider Line
  const divLeft = mapPoint(0.02, layout.header.dividerV, corners);
  const divRight = mapPoint(0.98, layout.header.dividerV, corners);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(divLeft.x, divLeft.y);
  ctx.lineTo(divRight.x, divRight.y);
  ctx.stroke();

  // 4. Draw Column Headers (Option letters A, B, C, D above first row of each column)
  for (let c = 0; c < layout.numColumns; c++) {
    const firstQNum = c * layout.questionsPerColumn + 1;
    const firstQ = layout.questions[firstQNum];
    if (firstQ) {
      quiz.options.forEach(opt => {
        const optCoord = firstQ.options[opt];
        const optPos = mapPoint(optCoord.u, optCoord.v - layout.rowSpacing * 0.55, corners);
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opt, optPos.x, optPos.y);
      });
    }
  }

  // 5. Draw Question Rows & Bubbles (1:1 with OMR Engine mapping)
  for (let q = 1; q <= quiz.numQuestions; q++) {
    const qInfo = layout.questions[q];
    if (!qInfo) continue;

    const labelPos = mapPoint(qInfo.labelU, qInfo.v, corners);

    // Light row zebra background for readability
    if (q % 2 === 0) {
      const colWidthU = 0.94 / layout.numColumns;
      const colStartU = 0.03 + qInfo.column * colWidthU;
      const rowLeft = mapPoint(colStartU + 0.02, qInfo.v, corners);
      const rowRight = mapPoint(colStartU + colWidthU - 0.02, qInfo.v, corners);
      const rowHeight = layout.rowSpacing * markerSpanY * 0.78;

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(rowLeft.x, rowLeft.y - rowHeight / 2, rowRight.x - rowLeft.x, rowHeight);
    }

    // Question Number Label
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${q}.`, labelPos.x, labelPos.y);

    // Bubbles
    const filledChoice = filledAnswers[q]; // Simulated student mark if any

    quiz.options.forEach(opt => {
      const optCoord = qInfo.options[opt];
      const bubblePos = mapPoint(optCoord.u, optCoord.v, corners);
      const bubbleRadius = optCoord.radius * markerSpanX;

      // Draw bubble circular outline
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(bubblePos.x, bubblePos.y, bubbleRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (filledChoice === opt) {
        // Dark filled circle representing pencil/pen mark
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        // Slightly organic radius to simulate real fill
        ctx.arc(bubblePos.x, bubblePos.y, bubbleRadius * 0.88, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Keep the sampled core empty; option letters are printed above each column.
      }
    });
  }

  // Footer / Form ID
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('QuickGrade Standard OMR Bubble Sheet • Keep sheet flat and corners visible during scanning', width / 2, height - 12);

  return canvas;
}

/**
 * Creates a simulated student sheet with realistic pencil marks for instant testing.
 */
export function generateSimulatedTestSheet(quiz, studentName = 'Alex Mercer', targetScore = null) {
  const numQuestions = quiz.numQuestions;
  const score = targetScore !== null ? Math.min(numQuestions, Math.max(0, targetScore)) : Math.round(numQuestions * 0.8);

  const answers = {};
  const questionIndices = Array.from({ length: numQuestions }, (_, i) => i + 1);
  const shuffled = [...questionIndices].sort(() => Math.random() - 0.5);
  const correctSet = new Set(shuffled.slice(0, score));

  for (let q = 1; q <= numQuestions; q++) {
    const correctOpt = quiz.answerKey[q] || 'A';
    if (correctSet.has(q)) {
      answers[q] = correctOpt;
    } else {
      const wrongOptions = quiz.options.filter(o => o !== correctOpt);
      answers[q] = wrongOptions[Math.floor(Math.random() * wrongOptions.length)] || 'B';
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;

  drawBubbleSheetToCanvas(canvas, quiz, {
    studentName,
    studentId: `STU-${Math.floor(1000 + Math.random() * 9000)}`,
    filledAnswers: answers
  });

  return {
    canvas,
    simulatedScore: score,
    simulatedAnswers: answers
  };
}
