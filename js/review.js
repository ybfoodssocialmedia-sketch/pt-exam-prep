/* review.js — Post-attempt answer review, shared by Practice and Exam, with filters */

const ReviewView = {
  paper: null,
  answers: {},
  marked: [],
  filter: 'all',
  index: 0,
  source: 'practice',

  async render(paperId, query) {
    let paper;
    try { paper = await Papers.getPaper(paperId); } catch (e) { return App.renderError(e); }
    this.paper = paper;
    this.source = query.source || 'practice';
    this.filter = query.filter || 'all';
    this.index = 0;

    if (this.source === 'exam') {
      const history = Store.getHistoryForPaper(paperId).filter(h => h.mode === 'exam');
      const entry = query.attempt ? history.find(h => h.id === query.attempt) : history[history.length - 1];
      if (!entry) { App.navigate('#/history'); return; }
      this.answers = entry.answers || {};
      this.marked = entry.marked || [];
      this.attemptLabel = 'Exam attempt — ' + Fmt.dateShort(entry.date);
    } else {
      const state = Store.getPracticeState(paperId);
      if (!state) { App.navigate('#/practice/' + paperId); return; }
      this.answers = state.answers || {};
      this.marked = [];
      this.attemptLabel = 'Practice session';
    }

    this.buildFilteredList();
    this.paint();
  },

  buildFilteredList() {
    const answers = this.answers;
    this.list = this.paper.questions.filter(q => {
      const given = answers[q.id];
      const answered = given !== undefined && given !== null && given !== '';
      switch (this.filter) {
        case 'correct': return answered && given === q.correctAnswer;
        case 'incorrect': return answered && given !== q.correctAnswer;
        case 'unanswered': return !answered;
        case 'marked': return this.marked.includes(q.id);
        default: return true;
      }
    });
    if (this.list.length === 0) this.list = this.paper.questions; // never show a blank review
  },

  setFilter(f) { this.filter = f; this.index = 0; this.buildFilteredList(); this.paint(); },

  paint() {
    if (this.list.length === 0) { this.list = this.paper.questions; }
    const q = this.list[this.index];
    const given = this.answers[q.id];
    const answered = given !== undefined && given !== null && given !== '';
    const isCorrect = answered && given === q.correctAnswer;

    let sourceLine = '';
    if (q.sourceBook) sourceLine = `Source: ${q.sourceBook}` + (q.sourceChapter ? `, Topic: ${q.sourceChapter}` : '') + (q.sourcePage ? `, p.${q.sourcePage}` : '');

    App.root.innerHTML = `
      <div class="container">
        <div class="q-meta">
          <span>🔍 Review — ${Fmt.escapeHtml(this.paper.paperName)} <span class="text-muted">(${Fmt.escapeHtml(this.attemptLabel)})</span></span>
          <span>Question ${this.index + 1} of ${this.list.length}</span>
        </div>
        <div class="filter-row">
          ${['all','correct','incorrect','unanswered','marked'].map(f => `<button class="filter-chip ${this.filter === f ? 'active' : ''}" data-f="${f}">${f[0].toUpperCase()+f.slice(1)}</button>`).join('')}
        </div>
        <div class="attempt-layout">
          <div class="card">
            <div class="tag-row" style="margin-bottom:10px;">
              <span class="tag subject">${Fmt.escapeHtml(q.subject)}</span>
              <span class="tag">${Fmt.escapeHtml(q.topic)}</span>
              ${!answered ? '<span class="tag" style="background:#f1f5f9;">Unanswered</span>' : (isCorrect ? '<span class="tag" style="background:var(--correct-bg);color:#166534;">Correct</span>' : '<span class="tag" style="background:var(--incorrect-bg);color:#991b1b;">Incorrect</span>')}
            </div>
            <div class="q-text">${Fmt.escapeHtml(q.question)}</div>
            <div class="options-list">
              ${Object.entries(q.options).map(([key, text]) => {
                let cls = 'option locked';
                if (key === q.correctAnswer) cls += ' correct-answer';
                else if (key === given) cls += ' wrong-selected';
                return `<div class="${cls}"><span class="opt-letter">${key}</span><span>${Fmt.escapeHtml(text)}</span></div>`;
              }).join('')}
            </div>
            <div class="explanation-box">
              <div>${Fmt.escapeHtml(q.explanation)}</div>
              ${sourceLine ? `<div class="source-line">${Fmt.escapeHtml(sourceLine)}</div>` : ''}
            </div>
            <div class="nav-buttons">
              <button class="btn btn-secondary" id="prev-btn" ${this.index === 0 ? 'disabled' : ''}>← Previous</button>
              <div class="right-group">
                <a class="btn btn-outline" href="#/">Back to Dashboard</a>
                <button class="btn btn-primary" id="next-btn" ${this.index === this.list.length - 1 ? 'disabled' : ''}>Next →</button>
              </div>
            </div>
          </div>
          <div class="side-panel">
            <div class="card">
              <div class="section-title" style="margin:0 0 10px;font-size:0.95rem;">Jump to Question</div>
              <div class="palette-grid">
                ${this.list.map((qq, i) => {
                  const g = this.answers[qq.id];
                  const a = g !== undefined && g !== null && g !== '';
                  let cls = 'palette-cell ' + (i === this.index ? 'current ' : '');
                  cls += !a ? 'unanswered' : (g === qq.correctAnswer ? 'review-correct' : 'review-incorrect');
                  return `<div class="${cls}" data-idx="${i}">${this.paper.questions.indexOf(qq) + 1}</div>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.querySelectorAll('.filter-chip').forEach(el => el.addEventListener('click', () => this.setFilter(el.dataset.f)));
    document.getElementById('prev-btn').addEventListener('click', () => { this.index--; this.paint(); });
    document.getElementById('next-btn').addEventListener('click', () => { this.index++; this.paint(); });
    document.querySelectorAll('.palette-cell').forEach(el => el.addEventListener('click', () => { this.index = parseInt(el.dataset.idx, 10); this.paint(); }));
  }
};
