/* ============================================================
   RONYX · render.js
   Shared helpers that turn Appwrite documents into HTML.
   ============================================================ */

const EXAM_META = {
  final:    { icon: '📘', accent: '#a78bfa', label: 'Final Exam' },
  mid:      { icon: '⚙️', accent: '#fbbf24', label: 'Mid Semester' },
  ca:       { icon: '📋', accent: '#f472b6', label: 'CA' },
  quiz:     { icon: '🗄️', accent: '#34d399', label: 'Quiz' },
  practice: { icon: '📝', accent: '#6ee7b7', label: 'Practice' },
};

function renderExamCard(exam) {
  const m = EXAM_META[exam.type] || EXAM_META.quiz;
  const parts = [];
  if (exam.courseCode)      parts.push(exam.courseCode);
  if (exam.subject)         parts.push(exam.subject);
  else if (exam.department) parts.push(exam.department);
  if (exam.durationMinutes) parts.push(exam.durationMinutes + ' min');

  const levelBadge = exam.level
    ? `<span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:6px;background:rgba(109,94,252,.14);color:#a89bff;text-transform:uppercase;letter-spacing:.04em;">Year ${exam.level}</span>`
    : '';
  const semBadge = exam.semester
    ? `<span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:6px;background:${exam.semester===1?'rgba(96,165,250,.12)':'rgba(52,211,153,.12)'};color:${exam.semester===1?'#60a5fa':'#34d399'};text-transform:uppercase;letter-spacing:.04em;">${exam.semester===1?'1st Sem':'2nd Sem'}</span>`
    : '';

  return `
    <a href="/pages/student/instructions.html?exam=${exam.$id}"
       style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--color-surface);border:1px solid var(--color-stroke);border-left:3px solid ${m.accent};border-radius:14px;margin-bottom:10px;text-decoration:none;color:inherit;">
      <div style="font-size:26px;flex-shrink:0;">${m.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${exam.title}</div>
        <div style="font-size:11px;color:var(--color-muted);margin-bottom:5px;">${parts.join(' · ')}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">${levelBadge}${semBadge}</div>
      </div>
      <span style="font-size:9px;font-weight:800;padding:3px 9px;border-radius:20px;background:rgba(109,94,252,.14);color:#a89bff;flex-shrink:0;">${m.label}</span>
    </a>`;
}
