/* exam.js — Exam Mode: instructions, timer-driven runner, palette, submit, results */

const ExamView = {
  paper: null,
  active: null,
  timerHandle: null,
  warned: { fifteen: false, five: false, one: false },

  async renderInstructions(paperId) {
    let paper;
    try { paper = await Papers.getPaper(paperId); } catch (e) { return App.renderError(e); }
    const rule = this.effectiveScoring(paper);
    const negText = rule.negativeMarkingEnabled
      ? `Incorrect answers currently carry a penalty of ${rule.incorrect} marks each.`
      : `There is currently no negative marking — incorrect answers score 0.`;

    App.root.innerHTML = `
      <div class="container">
        <h1>📝 Exam Instructions</h1>
        <div class="card">
          <h3 class="mt-0">${Fmt.escapeHtml(paper.paperName)}</h3>
          <div class="stat-strip">
            <div class="stat-box"><div class="num">${paper.questions.length}</div><div class="lbl">Total Questions</div></div>
            <div class="stat-box"><div class="num">${paper.durationMinutes}</div><div class="lbl">Minutes</div></div>
            <div class="stat-box"><div class="num">${paper.questions.length * rule.correct}</div><div class="lbl">Maximum Marks</div></div>
          </div>
          <ol class="instructions-list">
            <li>The paper contains <strong>${paper.questions.length} questions</strong>, each with exactly 4 options and one correct answer.</li>
            <li>You have exactly <strong>${paper.durationMinutes} minutes</strong>. The timer starts the moment you click "Start Exam" and cannot be paused.</li>
            <li>Scoring: <strong>Correct = +${rule.correct} mark(s)</strong>, Unanswered = 0. ${negText}</li>
            <li>You may navigate freely between questions in any order, and change your answer as many times as you like before submitting.</li>
            <li>You can <strong>Mark for Review</strong> any question, independent of whether you've answered it.</li>
            <li>No correct/incorrect indication, explanations, or score will be shown during the exam — only after you submit.</li>
            <li>If time runs out, the exam <strong>auto-submits automatically</strong> — no action needed from you, but nothing will be saved after that point.</li>
            <li>Once submitted (manually or automatically), the exam is locked permanently and cannot be reopened or resubmitted.</li>
          </ol>
          <div class="checkbox-row">
            <input type="checkbox" id="ack-checkbox">
            <label for="ack-checkbox">I have read and understood the instructions above.</label>
          </div>
          <button class="btn btn-exam" id="start-exam-btn" style="opacity:0.5;pointer-events:none;">Start Exam</button>
        </div>
      </div>`;

    const checkbox = document.getElementById('ack-checkbox');
    const startBtn = document.getElementById('start-exam-btn');
    checkbox.addEventListener('change', () => {
      startBtn.style.opacity = checkbox.checked ? '1' : '0.5';
      startBtn.style.pointerEvents = checkbox.checked ? 'auto' : 'none';
    });
    startBtn.addEventListener('click', () => {
      if (!checkbox.checked) return;
      this.startNewExam(paper);
    });
  },

  effectiveScoring(paper) {
    const settings = Store.getSettings();
    const rule = Object.assign({}, paper.scoring);
    if (settings.negativeMarkingOverride === true) { rule.negativeMarkingEnabled = true; if (!rule.incorrect) rule.incorrect = -0.25; }
    if (settings.negativeMarkingOverride === false) rule.negativeMarkingEnabled = false;
    return rule;
  },

  startNewExam(paper) {
    const state = {
      paperId: paper.paperId,
      startTimeISO: new Date().toISOString(),
      durationMinutes: paper.durationMinutes,
      answers: {},
      marked: [],
      currentIndex: 0,
      submitted: false
    };
    Store.setActiveExam(state);
    App.navigate('#/exam/run/' + paper.paperId);
  },

  async renderRun(paperId) {
    let paper;
    try { paper = await Papers.getPaper(paperId); } catch (e) { return App.renderError(e); }
    this.paper = paper;

    let active = Store.getActiveExam();
    if (!active || active.paperId !== paperId) {
      // No active exam for this paper — send back to instructions rather than guessing
      App.navigate('#/exam/instructions/' + paperId);
      return;
    }
    if (active.submitted) { App.navigate('#/exam/results/' + paperId); return; }
    this.active = active;
    this.warned = { fifteen: false, five: false, one: false };

    this.paintFrame();
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerHandle = setInterval(() => this.tick(), 1000);
  },

  remainingSeconds() {
    const start = new Date(this.active.startTimeISO).getTime();
    const totalSec = this.active.durationMinutes * 60;
    const elapsed = (Date.now() - start) / 1000;
    return Math.max(0, totalSec - elapsed);
  },

  tick() {
    const remaining = this.remainingSeconds();
    const timerEl = document.getElementById('exam-timer-display');
    if (timerEl) timerEl.textContent = Fmt.mmss(remaining);
    const box = document.getElementById('timer-box');
    if (box) {
      box.classList.remove('warn-15', 'warn-5', 'warn-1');
      if (remaining <= 60) box.classList.add('warn-1');
      else if (remaining <= 300) box.classList.add('warn-5');
      else if (remaining <= 900) box.classList.add('warn-15');
    }
    if (remaining <= 900 && !this.warned.fifteen) { this.warned.fifteen = true; this.toast('⏰ 15 minutes remaining'); }
    if (remaining <= 300 && !this.warned.five) { this.warned.five = true; this.toast('⏰ 5 minutes remaining!'); }
    if (remaining <= 60 && !this.warned.one) { this.warned.one = true; this.toast('⏰ 1 minute remaining!'); }
    if (remaining <= 0) {
      clearInterval(this.timerHandle);
      this.submitExam(true);
    }
  },

  toast(msg) {
    let t = document.getElementById('exam-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'exam-toast';
      t.style.cssText = 'position:fixed;top:70px;right:20px;background:#1e293b;color:#fff;padding:12px 18px;border-radius:8px;font-weight:600;z-index:200;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => { if (t) t.style.opacity = '0'; }, 4000);
  },

  get currentQuestion() { return this.paper.questions[this.active.currentIndex]; },

  paintFrame() {
    const q = this.currentQuestion;
    const idx = this.active.currentIndex;
    const total = this.paper.questions.length;
    const given = this.active.answers[q.id];
    const isMarked = this.active.marked.includes(q.id);
    const pct = ((idx + 1) / total) * 100;

    App.root.innerHTML = `
      <div class="container">
        <div class="q-meta">
          <span>📝 Exam — ${Fmt.escapeHtml(this.paper.paperName)}</span>
          <span>Question ${idx + 1} of ${total}</span>
        </div>
        <div class="progress-bar-track"><div class="progress-bar-fill exam-fill" style="width:${pct}%"></div></div>
        <div class="attempt-layout">
          <div class="card">
            <div class="tag-row" style="margin-bottom:10px;">
              ${isMarked ? '<span class="tag" style="background:var(--marked-bg);color:#92400e;">🚩 Marked for Review</span>' : ''}
            </div>
            <div class="q-text">${Fmt.escapeHtml(q.question)}</div>
            <div class="options-list" id="options-list">
              ${Object.entries(q.options).map(([key, text]) => `
                <div class="option ${given === key ? 'selected' : ''}" data-key="${key}">
                  <span class="opt-letter">${key}</span><span>${Fmt.escapeHtml(text)}</span>
                </div>`).join('')}
            </div>
            <div class="nav-buttons">
              <button class="btn btn-secondary" id="prev-btn" ${idx === 0 ? 'disabled' : ''}>← Previous</button>
              <div class="right-group">
                <button class="btn btn-outline" id="mark-btn">${isMarked ? '🚩 Unmark' : '🚩 Mark for Review'}</button>
                <button class="btn btn-primary" id="next-btn" ${idx === total - 1 ? 'disabled' : ''}>Next →</button>
              </div>
            </div>
          </div>
          <div class="side-panel">
            <div class="card timer-box" id="timer-box">
              <div class="label">Time Remaining</div>
              <div class="time" id="exam-timer-display">${Fmt.mmss(this.remainingSeconds())}</div>
            </div>
            <div class="card">
              <div class="section-title" style="margin:0 0 10px;font-size:0.95rem;">Question Palette</div>
              ${this.legendHtml()}
              <div class="palette-grid">${this.paletteHtml()}</div>
            </div>
            <button class="btn btn-exam" id="submit-exam-btn" style="width:100%;">Submit Exam</button>
          </div>
        </div>
      </div>`;

    this.attachHandlers(q);
  },

  legendHtml() {
    return `<div class="palette-legend">
      <span class="legend-item"><span class="legend-dot" style="background:var(--correct-bg);border:1px solid var(--correct)"></span>Answered</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--surface);border:1px solid var(--border)"></span>Unanswered</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--marked-bg);border:1px solid var(--marked)"></span>Marked</span>
      <span class="legend-item"><span class="legend-dot" style="background:transparent;border:2px solid var(--primary)"></span>Current</span>
    </div>`;
  },

  paletteHtml() {
    return this.paper.questions.map((q, i) => {
      const answered = this.active.answers[q.id] !== undefined;
      const marked = this.active.marked.includes(q.id);
      let cls = 'palette-cell ';
      if (i === this.active.currentIndex) cls += 'current ';
      if (answered && marked) cls += 'answered-marked';
      else if (marked) cls += 'marked';
      else if (answered) cls += 'answered';
      else cls += 'unanswered';
      return `<div class="${cls}" data-idx="${i}" title="Question ${i + 1}">${i + 1}</div>`;
    }).join('');
  },

  attachHandlers(q) {
    document.querySelectorAll('#options-list .option').forEach(el => {
      el.addEventListener('click', () => {
        this.active.answers[q.id] = el.dataset.key;
        Store.setActiveExam(this.active);
        this.paintFrame();
      });
    });
    document.getElementById('prev-btn').addEventListener('click', () => { this.active.currentIndex--; Store.setActiveExam(this.active); this.paintFrame(); });
    document.getElementById('next-btn').addEventListener('click', () => { this.active.currentIndex++; Store.setActiveExam(this.active); this.paintFrame(); });
    document.getElementById('mark-btn').addEventListener('click', () => {
      const i = this.active.marked.indexOf(q.id);
      if (i >= 0) this.active.marked.splice(i, 1); else this.active.marked.push(q.id);
      Store.setActiveExam(this.active);
      this.paintFrame();
    });
    document.querySelectorAll('.palette-cell').forEach(el => {
      el.addEventListener('click', () => { this.active.currentIndex = parseInt(el.dataset.idx, 10); Store.setActiveExam(this.active); this.paintFrame(); });
    });
    document.getElementById('submit-exam-btn').addEventListener('click', () => this.showSubmitModal());
  },

  showSubmitModal() {
    const total = this.paper.questions.length;
    const answered = Object.keys(this.active.answers).length;
    const unanswered = total - answered;
    const marked = this.active.marked.length;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <h3>Submit Exam?</h3>
        <p class="text-muted">Once submitted, you cannot change any answers.</p>
        <div class="modal-stats">
          <div><div style="font-weight:800;font-size:1.2rem;">${answered}/${total}</div><div class="text-muted" style="font-size:0.78rem;">Answered</div></div>
          <div><div style="font-weight:800;font-size:1.2rem;">${unanswered}/${total}</div><div class="text-muted" style="font-size:0.78rem;">Unanswered</div></div>
          <div><div style="font-weight:800;font-size:1.2rem;">${marked}</div><div class="text-muted" style="font-size:0.78rem;">Marked for Review</div></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="continue-exam-btn">Continue Exam</button>
          <button class="btn btn-exam" id="confirm-submit-btn">Submit Exam</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('continue-exam-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('confirm-submit-btn').addEventListener('click', () => {
      overlay.remove();
      this.submitExam(false);
    });
  },

  submitExam(auto) {
    if (!this.active || this.active.submitted) return; // never allow double submission
    if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = null; }
    this.active.submitted = true;
    this.active.submittedAt = new Date().toISOString();
    this.active.autoSubmitted = !!auto;

    const paper = this.paper;
    const rule = this.effectiveScoring(paper);
    const scoringPaper = Object.assign({}, paper, { scoring: rule });
    const result = Scoring.scoreAttempt(scoringPaper, this.active.answers);
    const timeTakenSec = Math.round((new Date(this.active.submittedAt).getTime() - new Date(this.active.startTimeISO).getTime()) / 1000);

    const historyEntry = {
      id: uid(), paperId: paper.paperId, paperName: paper.paperName, mode: 'exam',
      date: this.active.submittedAt, score: result.score, maxScore: result.maxScore,
      correct: result.correct, incorrect: result.incorrect, unanswered: result.unanswered,
      accuracy: result.accuracy, percentage: result.percentage, timeTakenSec,
      answers: this.active.answers, marked: this.active.marked, autoSubmitted: this.active.autoSubmitted
    };
    Store.addHistoryEntry(historyEntry);
    this.active.lastHistoryId = historyEntry.id;
    Store.setActiveExam(this.active); // keep submitted=true snapshot so a stray reload can't resubmit

    App.navigate('#/exam/results/' + paper.paperId);
  },

  async renderResults(paperId) {
    let paper;
    try { paper = await Papers.getPaper(paperId); } catch (e) { return App.renderError(e); }
    const active = Store.getActiveExam();
    const history = Store.getHistoryForPaper(paperId).filter(h => h.mode === 'exam');
    let entry = (active && active.lastHistoryId) ? history.find(h => h.id === active.lastHistoryId) : history[history.length - 1];
    if (!entry) { App.navigate('#/exam/instructions/' + paperId); return; }

    const breakdown = Scoring.topicBreakdown(paper, entry.answers || {});
    const strongest = breakdown.filter(t => t.attempted > 0).sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);
    const weakest = breakdown.filter(t => t.attempted > 0).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
    const avgTimePerQ = entry.timeTakenSec / paper.questions.length;
    const rule = this.effectiveScoring(paper);

    App.root.innerHTML = `
      <div class="container">
        <h1>📝 Exam Results — ${Fmt.escapeHtml(paper.paperName)}</h1>
        ${entry.autoSubmitted ? '<div class="card" style="background:var(--marked-bg);border-color:var(--marked);margin-bottom:16px;">⏰ This exam was auto-submitted when time ran out.</div>' : ''}
        <div class="card results-hero">
          <div class="score-num">${entry.score}/${entry.maxScore}</div>
          <div class="text-muted">${Fmt.pct(entry.percentage)}</div>
        </div>
        <div class="results-grid">
          <div class="box"><div class="n">${entry.correct}</div><div class="l">Correct</div></div>
          <div class="box"><div class="n">${entry.incorrect}</div><div class="l">Incorrect</div></div>
          <div class="box"><div class="n">${entry.unanswered}</div><div class="l">Unanswered</div></div>
          <div class="box"><div class="n">${Fmt.pct(entry.accuracy)}</div><div class="l">Accuracy</div></div>
          <div class="box"><div class="n">${Fmt.hms(entry.timeTakenSec)}</div><div class="l">Time Taken</div></div>
          <div class="box"><div class="n">${Fmt.hms(avgTimePerQ)}</div><div class="l">Avg / Question</div></div>
        </div>
        ${rule.negativeMarkingEnabled ? `<div class="card"><strong>Negative marking calculation:</strong> (${entry.correct} × +${rule.correct}) + (${entry.incorrect} × ${rule.incorrect}) + (${entry.unanswered} × 0) = <strong>${entry.score}</strong></div>` : ''}
        <div class="card">
          <div class="section-title" style="margin-top:0;">Topic-wise Performance</div>
          <table class="topic-table">
            <thead><tr><th>Topic</th><th>Attempted</th><th>Correct</th><th>Accuracy</th></tr></thead>
            <tbody>${breakdown.map(t => `<tr><td>${Fmt.escapeHtml(t.topic)}</td><td>${t.attempted}/${t.total}</td><td>${t.correct}</td><td>${Fmt.pct(t.accuracy)}</td></tr>`).join('')}</tbody>
          </table>
          <div class="callout-row">
            <div class="callout good"><h4>💪 Strongest Topics</h4><ul>${strongest.map(t => `<li>${Fmt.escapeHtml(t.topic)} — ${Fmt.pct(t.accuracy)}</li>`).join('') || '<li>Not enough data</li>'}</ul></div>
            <div class="callout bad"><h4>📌 Needs Improvement</h4><ul>${weakest.map(t => `<li>${Fmt.escapeHtml(t.topic)} — ${Fmt.pct(t.accuracy)}</li>`).join('') || '<li>Not enough data</li>'}</ul></div>
          </div>
        </div>
        <div class="action-row">
          <a class="btn btn-outline" href="#/review/${paper.paperId}?source=exam&attempt=${entry.id}">Review Answers</a>
          <a class="btn btn-outline" href="#/review/${paper.paperId}?source=exam&attempt=${entry.id}&filter=incorrect&mistakes=1">Study My Mistakes</a>
          <a class="btn btn-secondary" href="#/">Back to Dashboard</a>
        </div>
      </div>`;
  }
};
