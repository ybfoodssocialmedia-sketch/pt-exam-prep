/* practice.js — Practice Mode: immediate feedback, explanations, palette, filters */

const PracticeView = {
  paper: null,
  state: null, // { answers:{}, locked:{}, order:[], currentIndex, filterMode, filterTopic, startedAt, timeSpentSec }

  async render(paperId, query) {
    App.root.innerHTML = `<div class="container"><p class="text-muted">Loading paper…</p></div>`;
    let paper;
    try { paper = await Papers.getPaper(paperId); }
    catch (e) { return App.renderError(e); }
    this.paper = paper;

    let state = Store.getPracticeState(paperId);
    const wantsReset = query.reset === '1';
    const wantsNewFilter = query.filter && (!state || state.filterMode !== query.filter || (query.topic && state.filterTopic !== query.topic));

    if (!state || wantsNewFilter || wantsReset) {
      state = this.buildState(paper, query.filter || 'all', query.topic || null, wantsReset ? null : state);
    }
    this.state = state;
    this.persist();
    this.renderCurrent();
  },

  buildState(paper, filterMode, filterTopic, prevState) {
    let order;
    if (filterMode === 'incorrect') {
      const prevAnswers = (prevState && prevState.answers) || {};
      order = paper.questions.filter(q => prevAnswers[q.id] !== undefined && prevAnswers[q.id] !== q.correctAnswer).map(q => q.id);
    } else if (filterMode === 'unattempted') {
      const prevAnswers = (prevState && prevState.answers) || {};
      order = paper.questions.filter(q => prevAnswers[q.id] === undefined).map(q => q.id);
    } else if (filterMode === 'topic' && filterTopic) {
      order = paper.questions.filter(q => q.topic === filterTopic).map(q => q.id);
    } else {
      order = paper.questions.map(q => q.id);
    }
    if (order.length === 0) order = paper.questions.map(q => q.id); // fallback: never render an empty session
    return {
      answers: (prevState && filterMode === 'all') ? prevState.answers : {},
      order,
      currentIndex: 0,
      filterMode,
      filterTopic,
      startedAt: new Date().toISOString(),
      timeSpentSec: (prevState && prevState.timeSpentSec) || 0
    };
  },

  persist() { Store.setPracticeState(this.paper.paperId, this.state); },

  get currentQuestion() {
    const qid = this.state.order[this.state.currentIndex];
    return this.paper.questions.find(q => q.id === qid);
  },

  renderCurrent() {
    const q = this.currentQuestion;
    const total = this.state.order.length;
    const idx = this.state.currentIndex;
    const given = this.state.answers[q.id];
    const isLocked = given !== undefined;
    const pct = ((idx + 1) / total) * 100;

    App.root.innerHTML = `
      <div class="container">
        <div class="q-meta">
          <span>📚 Practice — ${Fmt.escapeHtml(this.paper.paperName)}</span>
          <span>Question ${idx + 1} of ${total}</span>
        </div>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="attempt-layout">
          <div class="card">
            <div class="tag-row" style="margin-bottom:10px;">
              <span class="tag subject">${Fmt.escapeHtml(q.subject)}</span>
              <span class="tag">${Fmt.escapeHtml(q.topic)}</span>
              <span class="tag difficulty-${(q.difficulty||'medium').toLowerCase()}">${Fmt.escapeHtml(q.difficulty)}</span>
            </div>
            <div class="q-text">${Fmt.escapeHtml(q.question)}</div>
            <div class="options-list" id="options-list">
              ${Object.entries(q.options).map(([key, text]) => this.optionHtml(q, key, text, given, isLocked)).join('')}
            </div>
            ${isLocked ? this.feedbackHtml(q, given) : ''}
            <div class="nav-buttons">
              <button class="btn btn-secondary" id="prev-btn" ${idx === 0 ? 'disabled' : ''}>← Previous</button>
              <div class="right-group">
                <a class="btn btn-outline" href="#/papers?mode=practice">Exit</a>
                ${isLocked ? `<button class="btn btn-primary" id="next-btn">${idx === total - 1 ? 'Finish' : 'Next Question →'}</button>` : ''}
              </div>
            </div>
          </div>
          <div class="side-panel">
            <div class="card">
              <div class="section-title" style="margin:0 0 10px;font-size:0.95rem;">Practice Options</div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <a class="btn btn-outline" href="#/practice/${encodeURIComponent(this.paper.paperId)}?filter=all">Practice All</a>
                <a class="btn btn-outline" href="#/practice/${encodeURIComponent(this.paper.paperId)}?filter=incorrect">Incorrect Only</a>
                <a class="btn btn-outline" href="#/practice/${encodeURIComponent(this.paper.paperId)}?filter=unattempted">Unattempted Only</a>
              </div>
            </div>
            <div class="card">
              <div class="section-title" style="margin:0 0 10px;font-size:0.95rem;">Question Palette</div>
              ${this.legendHtml()}
              <div class="palette-grid">${this.paletteHtml()}</div>
            </div>
          </div>
        </div>
      </div>`;

    this.attachHandlers(q, isLocked);
  },

  optionHtml(q, key, text, given, isLocked) {
    let cls = 'option';
    if (!isLocked && given === key) cls += ' selected';
    if (isLocked) {
      cls += ' locked';
      if (key === q.correctAnswer) cls += ' correct-answer';
      else if (key === given) cls += ' wrong-selected';
    }
    return `<div class="${cls}" data-key="${key}">
      <span class="opt-letter">${key}</span><span>${Fmt.escapeHtml(text)}</span>
    </div>`;
  },

  feedbackHtml(q, given) {
    const correct = given === q.correctAnswer;
    const sourceParts = [];
    if (q.sourceBook) sourceParts.push(q.sourceBook);
    let sourceLine = '';
    if (q.sourceBook) {
      sourceLine = `Source: ${q.sourceBook}` + (q.sourceChapter ? `, Topic: ${q.sourceChapter}` : '') + (q.sourcePage ? `, p.${q.sourcePage}` : '');
    }
    return `
      <div class="feedback-banner ${correct ? 'correct' : 'incorrect'}">${correct ? '✓ Correct!' : '✗ Incorrect'}</div>
      <div class="explanation-box">
        <div>${Fmt.escapeHtml(q.explanation)}</div>
        ${sourceLine ? `<div class="source-line">${Fmt.escapeHtml(sourceLine)}</div>` : ''}
      </div>`;
  },

  legendHtml() {
    return `<div class="palette-legend">
      <span class="legend-item"><span class="legend-dot" style="background:var(--correct-bg);border:1px solid var(--correct)"></span>Answered</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--surface);border:1px solid var(--border)"></span>Unanswered</span>
      <span class="legend-item"><span class="legend-dot" style="background:transparent;border:2px solid var(--primary)"></span>Current</span>
    </div>`;
  },

  paletteHtml() {
    return this.state.order.map((qid, i) => {
      const answered = this.state.answers[qid] !== undefined;
      const q = this.paper.questions.find(x => x.id === qid);
      let cls = 'palette-cell ';
      if (i === this.state.currentIndex) cls += 'current ';
      if (answered) {
        cls += (this.state.answers[qid] === q.correctAnswer) ? 'review-correct' : 'review-incorrect';
      } else {
        cls += 'unanswered';
      }
      return `<div class="${cls}" data-idx="${i}">${i + 1}</div>`;
    }).join('');
  },

  attachHandlers(q, isLocked) {
    if (!isLocked) {
      document.querySelectorAll('#options-list .option').forEach(el => {
        el.addEventListener('click', () => {
          this.state.answers[q.id] = el.dataset.key;
          this.persist();
          this.renderCurrent();
        });
      });
    }
    const prevBtn = document.getElementById('prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => { this.state.currentIndex--; this.persist(); this.renderCurrent(); });
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (this.state.currentIndex < this.state.order.length - 1) {
        this.state.currentIndex++;
        this.persist();
        this.renderCurrent();
      } else {
        App.navigate('#/practice-results/' + encodeURIComponent(this.paper.paperId));
      }
    });
    document.querySelectorAll('.palette-cell').forEach(el => {
      el.addEventListener('click', () => { this.state.currentIndex = parseInt(el.dataset.idx, 10); this.persist(); this.renderCurrent(); });
    });
  },

  async renderResults(paperId) {
    let paper;
    try { paper = await Papers.getPaper(paperId); } catch (e) { return App.renderError(e); }
    const state = Store.getPracticeState(paperId);
    if (!state) { App.navigate('#/practice/' + encodeURIComponent(paperId)); return; }

    const attemptedIds = Object.keys(state.answers).map(Number);
    const attemptedQuestions = paper.questions.filter(q => attemptedIds.includes(q.id));
    const totalAttempted = attemptedQuestions.length;
    const correctCount = attemptedQuestions.filter(q => state.answers[q.id] === q.correctAnswer).length;
    const incorrectCount = totalAttempted - correctCount;
    const accuracy = totalAttempted > 0 ? (correctCount / totalAttempted) * 100 : 0;

    // Record history entry for this practice pass (only if something was attempted and mode was 'all')
    if (state.filterMode === 'all' && totalAttempted > 0 && !state._recorded) {
      Store.addHistoryEntry({
        id: uid(), paperId: paper.paperId, paperName: paper.paperName, mode: 'practice',
        date: new Date().toISOString(), score: correctCount, maxScore: totalAttempted,
        correct: correctCount, incorrect: incorrectCount, unanswered: paper.questions.length - totalAttempted,
        accuracy, percentage: accuracy, timeTakenSec: 0
      });
      state._recorded = true;
      Store.setPracticeState(paperId, state);
    }

    const breakdown = Scoring.topicBreakdown(paper, state.answers);

    App.root.innerHTML = `
      <div class="container">
        <h1>Practice Results — ${Fmt.escapeHtml(paper.paperName)}</h1>
        <div class="card results-hero">
          <div class="score-num">${correctCount}/${totalAttempted || paper.questions.length}</div>
          <div class="text-muted">Correct answers out of attempted questions</div>
        </div>
        <div class="results-grid">
          <div class="box"><div class="n">${correctCount}</div><div class="l">Correct</div></div>
          <div class="box"><div class="n">${incorrectCount}</div><div class="l">Incorrect</div></div>
          <div class="box"><div class="n">${totalAttempted}</div><div class="l">Attempted</div></div>
          <div class="box"><div class="n">${Fmt.pct(accuracy)}</div><div class="l">Accuracy</div></div>
        </div>
        <div class="card">
          <div class="section-title" style="margin-top:0;">Topic-wise Breakdown</div>
          <table class="topic-table">
            <thead><tr><th>Topic</th><th>Attempted</th><th>Correct</th><th>Accuracy</th></tr></thead>
            <tbody>${breakdown.map(t => `<tr><td>${Fmt.escapeHtml(t.topic)}</td><td>${t.attempted}/${t.total}</td><td>${t.correct}</td><td>${Fmt.pct(t.accuracy)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="action-row">
          <a class="btn btn-outline" href="#/review/${encodeURIComponent(paper.paperId)}?source=practice">Review Answers</a>
          <a class="btn btn-outline" href="#/practice/${encodeURIComponent(paper.paperId)}?filter=incorrect">Practice Incorrect Questions</a>
          <a class="btn btn-primary" href="#/practice/${encodeURIComponent(paper.paperId)}?filter=all&reset=1">Practice Again</a>
          <a class="btn btn-secondary" href="#/">Back to Dashboard</a>
        </div>
      </div>`;
  }
};
