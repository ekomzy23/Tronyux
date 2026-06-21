/* ============================================================
   RUNYX · render.js
   Shared helpers that turn Appwrite documents into HTML.
   Load after data.js on any page that lists exams.
   ============================================================ */

// icon + badge styling per exam type
const EXAM_META = {
  final:      { icon: '📘', badge: 'badge--violet', label: 'Final' },
  mid:        { icon: '⚙️', badge: 'badge--green',  label: 'Mid' },
  quiz:       { icon: '🗄️', badge: 'badge--violet', label: 'Quiz' },
  practice:   { icon: '📝', badge: 'badge--green',  label: 'Practice' },
  assignment: { icon: '🤖', badge: 'badge--violet', label: 'Assign' },
  ca:         { icon: '📋', badge: 'badge--green',  label: 'CA' },
};

// format an exam's meta line
function examMetaLine(exam) {
  const parts = [];
  if (exam.courseCode) parts.push(exam.courseCode);
  if (exam.durationMinutes) parts.push(exam.durationMinutes + ' min');
  if (exam.totalMarks) parts.push(exam.totalMarks + ' marks');
  return parts.join(' · ');
}

// build one exam row-card
function renderExamCard(exam) {
  const m = EXAM_META[exam.type] || EXAM_META.quiz;
  return `
    <a href="/pages/student/instructions.html?exam=${exam.$id}" class="row-card">
      <div class="row-card__icon">${m.icon}</div>
      <div class="row-card__meta">
        <h4>${exam.title}</h4>
        <p>${examMetaLine(exam)}</p>
      </div>
      <span class="badge ${m.badge}">${m.label}</span>
    </a>`;
}
