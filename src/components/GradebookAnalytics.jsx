import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Trash2,
  Eye,
  User,
  CheckCircle2,
  XCircle,
  Award,
  TrendingUp,
  AlertCircle,
  X,
  FileSpreadsheet,
  Camera
} from 'lucide-react';

export default function GradebookAnalytics({
  quiz,
  onUpdateQuiz,
  onNavigateToScan
}) {
  const submissions = quiz.submissions || [];
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Compute Class Stats
  const totalSubmissions = submissions.length;
  const totalScoreSum = submissions.reduce((acc, s) => acc + (s.score || 0), 0);
  const classAvgScore = totalSubmissions > 0 ? (totalScoreSum / totalSubmissions).toFixed(1) : 0;
  const classAvgPercent = totalSubmissions > 0 ? Math.round((totalScoreSum / (totalSubmissions * quiz.numQuestions)) * 100) : 0;

  const scores = submissions.map(s => s.score || 0);
  const highScore = totalSubmissions > 0 ? Math.max(...scores) : 0;
  const lowScore = totalSubmissions > 0 ? Math.min(...scores) : 0;

  // Grade Distribution (A, B, C, D, F)
  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  submissions.forEach(s => {
    const letter = s.letterGrade?.[0] || 'F';
    if (distribution[letter] !== undefined) {
      distribution[letter]++;
    } else {
      distribution['F']++;
    }
  });

  // Question Item Analysis
  const itemAnalysis = [];
  for (let q = 1; q <= quiz.numQuestions; q++) {
    let correctCount = 0;
    const optionCounts = {};
    quiz.options.forEach(opt => { optionCounts[opt] = 0; });

    submissions.forEach(s => {
      const ans = s.answers?.[q];
      if (ans) {
        if (ans.isCorrect) correctCount++;
        if (optionCounts[ans.selected] !== undefined) {
          optionCounts[ans.selected]++;
        }
      }
    });

    const percentCorrect = totalSubmissions > 0 ? Math.round((correctCount / totalSubmissions) * 100) : 0;

    // Most common wrong answer
    const correctAnswer = quiz.answerKey[q];
    let mostCommonWrong = '-';
    let highestWrongCount = 0;
    quiz.options.forEach(opt => {
      if (opt !== correctAnswer && optionCounts[opt] > highestWrongCount) {
        highestWrongCount = optionCounts[opt];
        mostCommonWrong = opt;
      }
    });

    itemAnalysis.push({
      questionNumber: q,
      correctAnswer,
      percentCorrect,
      correctCount,
      mostCommonWrong: highestWrongCount > 0 ? `${mostCommonWrong} (${highestWrongCount})` : 'None'
    });
  }

  // Delete single submission
  const handleDeleteSubmission = (subId) => {
    if (window.confirm('Delete this graded paper?')) {
      const updated = submissions.filter(s => s.id !== subId);
      onUpdateQuiz({
        ...quiz,
        submissions: updated
      });
      if (selectedSubmission?.id === subId) {
        setSelectedSubmission(null);
      }
    }
  };

  // Clear all submissions
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all graded submissions for this quiz?')) {
      onUpdateQuiz({
        ...quiz,
        submissions: []
      });
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (submissions.length === 0) {
      alert('No graded submissions to export.');
      return;
    }

    const cell=value=> '"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
    const headers=['Student Name','Student ID','Score','Total Possible','Percentage','Letter Grade','Scanned Date',...Array.from({length:quiz.numQuestions},(_,i)=>`Q${i+1} (Key: ${quiz.answerKey[i+1]||'?'})`)];
    const rows=submissions.map(s=>[s.studentName,s.studentId,s.score,s.totalPossible,s.percentage,s.letterGrade,new Date(s.scannedAt).toLocaleString(),...Array.from({length:quiz.numQuestions},(_,i)=>s.answers?.[i+1]?.selected||'BLANK')]);
    const csv='\ufeff'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;
    link.download=`QuickGrade_${quiz.title.replace(/[^a-z0-9_-]/gi,'_')}_Grades.csv`;
    link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 mb-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Gradebook & Insights
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {totalSubmissions} papers scanned
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{quiz.title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Automated score records, question difficulty item analysis, and gradebook export.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={totalSubmissions === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onNavigateToScan}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition"
            >
              <Camera className="w-4 h-4" />
              <span>Scan More</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">Class Average</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {classAvgPercent}%
              <span className="text-xs font-normal text-slate-500 ml-1">({classAvgScore} / {quiz.numQuestions})</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">Papers Graded</div>
            <div className="text-2xl font-black text-indigo-600 mt-1">{totalSubmissions}</div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">High Score</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {totalSubmissions > 0 ? `${highScore} / ${quiz.numQuestions}` : '-'}
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">Low Score</div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {totalSubmissions > 0 ? `${lowScore} / ${quiz.numQuestions}` : '-'}
            </div>
          </div>
        </div>

        {/* Grade Distribution Breakdown Bar */}
        {totalSubmissions > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 mb-2">Grade Distribution:</div>
            <div className="flex items-center gap-2">
              {['A', 'B', 'C', 'D', 'F'].map(grade => {
                const count = distribution[grade] || 0;
                const pct = totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0;
                return (
                  <div key={grade} className="flex-1 bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-center">
                    <span className="text-xs font-bold text-slate-500">{grade}</span>
                    <div className="text-sm font-black text-slate-800">{count}</div>
                    <div className="text-[10px] text-slate-400">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Grid for Roster vs Item Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Submissions Table */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                Student Submissions ({totalSubmissions})
              </h2>

              {totalSubmissions > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs font-medium text-slate-400 hover:text-rose-600 transition"
                >
                  Clear All
                </button>
              )}
            </div>

            {totalSubmissions === 0 ? (
              <div className="p-12 text-center">
                <Camera className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 mb-1">No Graded Papers Yet</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Use the camera scanner or try a demo paper to start grading.
                </p>
                <button
                  onClick={onNavigateToScan}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition"
                >
                  Launch Scanner
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5">Student</th>
                      <th className="px-4 py-3.5">Score</th>
                      <th className="px-4 py-3.5">Percentage</th>
                      <th className="px-4 py-3.5">Grade</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.map((sub, idx) => {
                      return (
                        <tr key={sub.id || idx} className="hover:bg-slate-50/60 transition">
                          <td className="px-6 py-3.5">
                            <div className="font-bold text-slate-900">{sub.studentName}</div>
                            <div className="text-xs text-slate-400">ID: {sub.studentId || 'N/A'}</div>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-800">
                            {sub.score} / {sub.totalPossible}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-slate-700">{sub.percentage}%</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              sub.percentage >= 80
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : sub.percentage >= 60
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {sub.letterGrade}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {sub.imageUrl && (
                                <button
                                  onClick={() => setSelectedSubmission(sub)}
                                  title="View Graded Overlay Sheet"
                                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
                                >
                                  <Eye className="w-4 h-4 text-indigo-600" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSubmission(sub.id)}
                                title="Delete"
                                className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Question Item Analysis */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Item Analysis
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Accuracy by question. Identifies tricky concepts & common student errors.
            </p>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {itemAnalysis.map(item => {
                const isChallenging = item.percentCorrect < 60;
                return (
                  <div
                    key={item.questionNumber}
                    className={`p-3 rounded-2xl border transition ${
                      isChallenging
                        ? 'bg-rose-50/60 border-rose-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">Q{item.questionNumber}</span>
                        <span className="text-xs text-slate-500">Key: <strong className="text-emerald-700 font-bold">{item.correctAnswer}</strong></span>
                      </div>
                      <span className={`text-xs font-bold ${
                        item.percentCorrect >= 80 ? 'text-emerald-700' : isChallenging ? 'text-rose-700' : 'text-amber-700'
                      }`}>
                        {item.percentCorrect}% correct
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${
                          item.percentCorrect >= 80 ? 'bg-emerald-500' : isChallenging ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${item.percentCorrect}%` }}
                      />
                    </div>

                    {isChallenging && totalSubmissions > 0 && (
                      <div className="mt-2 text-[11px] text-rose-700 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>Common mistake: <strong>{item.mostCommonWrong}</strong></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* View Graded Sheet Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedSubmission.studentName}</h3>
                <p className="text-xs text-slate-500">
                  Score: {selectedSubmission.score} / {selectedSubmission.totalPossible} ({selectedSubmission.percentage}%) • Grade {selectedSubmission.letterGrade}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-slate-200">
              <img
                src={selectedSubmission.imageUrl}
                alt="Student Graded Paper"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
