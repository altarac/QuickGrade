// Quiz Data Model and LocalStorage Helpers (Clean - No Premade Quizzes)

export const DEFAULT_OPTIONS = ['A', 'B', 'C', 'D'];

const STORAGE_KEY = 'quickgrade_quizzes_v2';

export function loadStoredQuizzes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return validateQuizzes(parsed);
  } catch (err) {
    console.error('Failed to load stored quizzes:', err);
    return [];
  }
}

export function saveStoredQuizzes(quizzes) {
  try {
    // Photos are available for this session; store compact grading records persistently.
    const compact=quizzes.map(q=>({...q,submissions:(q.submissions||[]).map(({imageUrl,...submission})=>submission)}));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    return true;
  } catch (err) {
    console.error('Failed to save stored quizzes:', err);
    return false;
  }
}

export function calculateGrade(score, total) {
  if (!total || total <= 0) return { percentage: 0, letter: 'F', color: 'text-rose-500' };
  const percentage = Math.round((score / total) * 100);
  let letter = 'F';
  let color = 'text-rose-500';

  if (percentage >= 97) { letter = 'A+'; color = 'text-emerald-500'; }
  else if (percentage >= 93) { letter = 'A'; color = 'text-emerald-500'; }
  else if (percentage >= 90) { letter = 'A-'; color = 'text-emerald-500'; }
  else if (percentage >= 87) { letter = 'B+'; color = 'text-teal-500'; }
  else if (percentage >= 83) { letter = 'B'; color = 'text-teal-500'; }
  else if (percentage >= 80) { letter = 'B-'; color = 'text-teal-500'; }
  else if (percentage >= 77) { letter = 'C+'; color = 'text-amber-500'; }
  else if (percentage >= 70) { letter = 'C'; color = 'text-amber-500'; }
  else if (percentage >= 60) { letter = 'D'; color = 'text-orange-500'; }
  else { letter = 'F'; color = 'text-rose-500'; }

  return { percentage, letter, color };
}

export function validateQuizzes(data) {
  if(!Array.isArray(data)||data.length>500) throw new Error('Backup must contain a quiz list.');
  const ids=new Set();
  return data.map(q=> {
    if(!q||typeof q.id!=='string'||ids.has(q.id)||typeof q.title!=='string'||!Number.isInteger(q.numQuestions)||q.numQuestions<1||q.numQuestions>100||!Array.isArray(q.options)||![4,5].includes(q.options.length)||q.options.some((o,i)=>o!=='ABCDE'[i])) throw new Error('Backup contains an invalid quiz.');
    ids.add(q.id);
    const answerKey={};for(let n=1;n<=q.numQuestions;n++) if(q.options.includes(q.answerKey?.[n])) answerKey[n]=q.answerKey[n];
    if(q.submissions && !Array.isArray(q.submissions)) throw new Error('Invalid grade records.');
    const submissions=(q.submissions||[]).map(s=> {
      if(!s||typeof s.studentName!=='string'||!Number.isFinite(s.score)||!Number.isFinite(s.totalPossible)||s.totalPossible<=0||s.score<0||s.score>s.totalPossible||!s.answers||typeof s.answers!=='object'||!Number.isFinite(Date.parse(s.scannedAt))) throw new Error('Backup contains an invalid grade record.');
      const answers={};for(let n=1;n<=q.numQuestions;n++) {
        const a=s.answers[n];if(!a||![...q.options,'BLANK','MULTI'].includes(a.selected)) throw new Error('Invalid recorded answer.');
        answers[n]={...a,questionNumber:n};
      }
      const grade=calculateGrade(s.score,s.totalPossible);
      return {...s,quizId:q.id,answers,imageUrl:undefined,percentage:grade.percentage,letterGrade:grade.letter};
    });
    return {...q,title:q.title.slice(0,180),course:String(q.course||'').slice(0,120),answerKey,submissions,pointsPerQuestion:typeof q.pointsPerQuestion==='number'&&q.pointsPerQuestion>0?q.pointsPerQuestion:1};
  });
}
