/* ============================================================
   RUNYX · seed.js
   Loads sample exams + questions so the app has real data.
   Runs automatically as part of `npm run backend`.
   ============================================================ */

require('dotenv').config();
const { Client, Databases, ID } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB = 'runyx';

// the exams to create (id is fixed so re-runs are safe)
const EXAMS = [
  { id: 'ds-final', title: 'Data Structures Final', courseCode: 'CS301', type: 'final', level: 2,
    durationMinutes: 90, passMark: 50,
    questions: [
      { type:'mcq', text:'What is the time complexity of binary search?',
        options: JSON.stringify(['O(n)','O(log n)','O(n²)','O(1)']), correctAnswer:'O(log n)', marks:3, topic:'Complexity' },
      { type:'truefalse', text:'A stack follows First-In-First-Out order.',
        options: JSON.stringify(['True','False']), correctAnswer:'False', marks:3, topic:'Stacks' },
      { type:'theory', text:'Explain the concept of recursion with an example.',
        options:'', correctAnswer:'', marks:4, topic:'Recursion' },
    ] },
  { id: 'os-mid', title: 'Operating Systems Mid Sem', courseCode: 'CS305', type: 'mid', level: 2,
    durationMinutes: 60, passMark: 40,
    questions: [
      { type:'mcq', text:'Which scheduling algorithm can cause starvation?',
        options: JSON.stringify(['Round Robin','FCFS','Priority','SJF (non-preemptive)']), correctAnswer:'Priority', marks:3, topic:'Scheduling' },
      { type:'truefalse', text:'A deadlock requires the "circular wait" condition.',
        options: JSON.stringify(['True','False']), correctAnswer:'True', marks:3, topic:'Deadlocks' },
    ] },
  { id: 'db-quiz', title: 'Database Systems Quiz', courseCode: 'CS310', type: 'quiz', level: 1,
    durationMinutes: 30, passMark: 50,
    questions: [
      { type:'mcq', text:'Which normal form removes transitive dependencies?',
        options: JSON.stringify(['1NF','2NF','3NF','BCNF']), correctAnswer:'3NF', marks:2, topic:'Normalization' },
      { type:'mcq', text:'What does ACID stand for in databases?',
        options: JSON.stringify(['Atomicity, Consistency, Isolation, Durability','Access, Control, Integrity, Data','Atomic, Cache, Index, Disk','None']),
        correctAnswer:'Atomicity, Consistency, Isolation, Durability', marks:2, topic:'Transactions' },
    ] },
];

async function run() {
  console.log('\n▶ Seeding exams + questions…');

  for (const ex of EXAMS) {
    const totalMarks = ex.questions.reduce((s, q) => s + q.marks, 0);
    try {
      await databases.createDocument(DB, 'exams', ex.id, {
        title: ex.title, courseCode: ex.courseCode, type: ex.type, level: ex.level || 0,
        durationMinutes: ex.durationMinutes, totalMarks,
        questionsCount: ex.questions.length, status: 'published',
        passMark: ex.passMark, maxAttempts: 1, createdBy: 'seed',
        instructions: 'Read each question carefully. Progress auto-saves.',
      });
      console.log('  ✓ exam:', ex.title);
    } catch (e) { console.log('  • exam exists:', ex.title); }

    for (const q of ex.questions) {
      try {
        await databases.createDocument(DB, 'questions', ID.unique(), { examId: ex.id, ...q });
      } catch (e) { console.log('  ✗ question:', e.message); }
    }
    console.log('    ↳ ' + ex.questions.length + ' questions');
  }


  console.log('\n▶ Seeding library books…');
  const BOOKS = [
    { title:'Data Structures Essentials', author:'Runyx Press', subject:'Computer Science', cover:'📘', readMinutes:12, pages:240,
      summary:`This book builds intuition for how data is organised in memory and why the right structure makes algorithms fast.\n\nIt starts with arrays and linked lists, showing the trade-off between fast indexing and flexible insertion. Stacks and queues follow, framed through everyday analogies like undo history and printer jobs.\n\nThe middle chapters develop trees and hash tables, explaining how balancing and hashing keep operations close to constant or logarithmic time. The final part connects each structure to the problems it solves best, so you choose tools by reasoning, not by memory.`,
      takeaways: JSON.stringify(['Pick a structure by the operations you repeat most','Hashing trades memory for near-constant lookup','Balanced trees keep search predictable','Big-O describes growth, not raw speed']) },
    { title:'Operating Systems Fundamentals', author:'Runyx Press', subject:'Computer Science', cover:'⚙️', readMinutes:15, pages:310,
      summary:`A clear tour of how an operating system shares one machine among many programs.\n\nIt explains processes and threads, then how the scheduler decides who runs next and why fairness can fight efficiency. Memory chapters cover virtual memory and paging, showing how each program gets the illusion of its own space.\n\nLater sections cover deadlocks, synchronisation and file systems, with simple rules for avoiding the classic traps. By the end you can reason about why a system slows down and where the bottleneck likely lives.`,
      takeaways: JSON.stringify(['The scheduler balances fairness against throughput','Virtual memory gives each process a private view','Deadlock needs four conditions — break one to prevent it','Locks protect shared data but cost time']) },
    { title:'Database Design Basics', author:'Runyx Press', subject:'Computer Science', cover:'🗄️', readMinutes:10, pages:180,
      summary:`This short guide turns messy data into clean, reliable tables.\n\nIt introduces relations, keys and the idea that every fact should live in exactly one place. Normalisation is presented step by step, removing repetition that causes update errors.\n\nThe book then covers transactions and the ACID guarantees that keep data correct even when many users write at once, closing with practical indexing tips for speed.`,
      takeaways: JSON.stringify(['Store each fact once to avoid update anomalies','Keys give every row a unique identity','ACID keeps transactions safe and consistent','Indexes speed reads but slow writes']) },
    { title:'Clear Thinking for Exams', author:'Runyx Press', subject:'Study Skills', cover:'🧠', readMinutes:8, pages:120,
      summary:`A practical method for learning faster and remembering longer.\n\nIt explains active recall — testing yourself instead of rereading — and spaced repetition, which schedules reviews just before you forget. The book shows how to turn a summary into questions and how to study weak topics first.\n\nThe closing chapters cover managing exam time, staying calm, and writing answers that earn marks efficiently.`,
      takeaways: JSON.stringify(['Test yourself — recall beats rereading','Space reviews to fight forgetting','Attack weak topics first','Plan time per question before you start']) },
  ];
  for (const b of BOOKS) {
    try { await databases.createDocument(DB, 'books', ID.unique(), b); console.log('  ✓ book:', b.title); }
    catch (e) { console.log('  • book:', e.message); }
  }

  console.log('\n✅ Seed complete.\n');
}

run();
