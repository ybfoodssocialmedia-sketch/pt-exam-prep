/* app.js — router + dashboard, paper list, history, settings views */

const App = {
  root: null,

  init() {
    this.root = document.getElementById('app');
    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('beforeunload', (e) => {
      const active = Store.getActiveExam();
      if (active && !active.submitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    this.route();
  },

  navigate(hash) { window.location.hash = hash; },

  parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const query = {};
    if (queryPart) {
      queryPart.split('&').forEach(kv => {
        const [k, v] = kv.split('=');
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { parts, query };
  },

  async route() {
    const { parts, query } = this.parseHash();
    this.highlightNav(parts[0] || '');
    try {
      if (parts.length === 0) return this.renderDashboard();
      if (parts[0] === 'papers') return this.renderPaperList(query.mode || 'practice');
      if (parts[0] === 'practice' && parts[1]) return PracticeView.render(parts[1], query);
      if (parts[0] === 'practice-results' && parts[1]) return PracticeView.renderResults(parts[1]);
      if (parts[0] === 'exam' && parts[1] === 'instructions' && parts[2]) return ExamView.renderInstructions(parts[2]);
      if (parts[0] === 'exam' && parts[1] === 'run' && parts[2]) return ExamView.renderRun(parts[2]);
      if (parts[0] === 'exam' && parts[1] === 'results' && parts[2]) return ExamView.renderResults(parts[2]);
      if (parts[0] === 'review' && parts[1]) return ReviewView.render(parts[1], query);
      if (parts[0] === 'history') return this.renderHistory();
      if (parts[0] === 'settings') return this.renderSettings();
      return this.renderDashboard();
    } catch (err) {
      console.error(err);
      this.renderError(err);
    }
  },

  highlightNav(section) {
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.dataset.section === section);
    });
  },

  renderError(err) {
    this.root.innerHTML = `
      <div class="container">
        <div class="card">
          <h2>Something went wrong</h2>
          <p class="text-muted">${Fmt.escapeHtml(err.message || String(err))}</p>
          <a class="btn btn-secondary" href="#/" style="display:inline-block;margin-top:10px;">Back to Dashboard</a>
        </div>
      </div>`;
  },

  async renderDashboard() {
    let papers = [];
    try { papers = await Papers.getManifest(); } catch (e) { /* handled below */ }
    const history = Store.getHistory();
    this.root.innerHTML = `
      <div class="container">
        <h1 style="margin-bottom:4px;">Welcome back 👋</h1>
        <p class="text-muted" style="margin-top:0;">Choose how you want to study today.</p>
        <div class="mode-cards">
          <div class="mode-card practice">
            <div class="icon">📚</div>
            <h2>Practice Mode</h2>
            <p class="tagline">Learn while you practice</p>
            <ul>
              <li>Immediate feedback after each question</li>
              <li>Detailed, book-grounded explanations</li>
              <li>Self-paced — no timer</li>
              <li>Review incorrect questions anytime</li>
            </ul>
            <a class="btn-white" href="#/papers?mode=practice">Start Practice</a>
          </div>
          <div class="mode-card exam">
            <div class="icon">📝</div>
            <h2>Exam Mode</h2>
            <p class="tagline">Simulate the real exam</p>
            <ul>
              <li>100 questions, 90-minute timer</li>
              <li>No answers revealed during the exam</li>
              <li>Free navigation + mark for review</li>
              <li>Detailed results after submission</li>
            </ul>
            <a class="btn-white" href="#/papers?mode=exam">Start Exam</a>
          </div>
        </div>

        <div class="section-title">Recent Activity</div>
        ${history.length === 0 ? `
          <div class="card empty-state">
            <div class="big-icon">🕒</div>
            <p>No attempts yet. Start a Practice or Exam session above to see your history here.</p>
          </div>` : this.recentActivityTable(history.slice(-5).reverse())}
      </div>`;
  },

  recentActivityTable(entries) {
    return `<div class="card history-table-wrap"><table class="topic-table">
      <thead><tr><th>Paper</th><th>Mode</th><th>Date</th><th>Score</th><th>Accuracy</th></tr></thead>
      <tbody>${entries.map(e => `
        <tr>
          <td>${Fmt.escapeHtml(e.paperName)}</td>
          <td>${e.mode === 'exam' ? '📝 Exam' : '📚 Practice'}</td>
          <td>${Fmt.dateShort(e.date)}</td>
          <td>${e.score}/${e.maxScore}</td>
          <td>${Fmt.pct(e.accuracy)}</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
  },

  async renderPaperList(mode) {
    let manifest = [];
    let loadError = null;
    try { manifest = await Papers.getManifest(); } catch (e) { loadError = e.message; }
    const history = Store.getHistory();

    if (loadError) {
      this.root.innerHTML = `<div class="container"><div class="card"><h2>Could not load papers</h2><p class="text-muted">${Fmt.escapeHtml(loadError)}</p></div></div>`;
      return;
    }

    this.root.innerHTML = `
      <div class="container">
        <h1>${mode === 'exam' ? '📝 Choose a paper for Exam Mode' : '📚 Choose a paper for Practice Mode'}</h1>
        <div class="paper-grid">
          ${manifest.map(p => this.paperCard(p, mode, history)).join('')}
        </div>
      </div>`;
  },

  paperCard(p, mode, history) {
    const attempts = history.filter(h => h.paperId === p.id);
    const best = attempts.length ? Math.max(...attempts.map(a => a.percentage)) : null;
    const diffClass = 'difficulty-' + (p.difficulty || 'Mixed').toLowerCase();
    return `
      <div class="paper-card">
        <div class="tag-row">
          <span class="tag subject">${Fmt.escapeHtml(p.subject)}</span>
          <span class="tag ${diffClass}">${Fmt.escapeHtml(p.difficulty || 'Mixed')}</span>
          ${p.isSample ? '<span class="tag">Sample data</span>' : ''}
        </div>
        <h3>${Fmt.escapeHtml(p.name)}</h3>
        <p class="desc">${Fmt.escapeHtml(p.description || '')}</p>
        <div class="meta-row"><span>${p.questionCount ? p.questionCount + ' questions' : 'Question count shown after loading'}</span>${best !== null ? `<span class="prev-score">Best: ${Fmt.pct(best)}</span>` : ''}</div>
        <div class="actions">
          <a class="btn btn-practice" href="#/practice/${p.id}">Start Practice</a>
          <a class="btn btn-exam" href="#/exam/instructions/${p.id}">Start Exam</a>
        </div>
      </div>`;
  },

  renderHistory() {
    const history = Store.getHistory();
    if (history.length === 0) {
      this.root.innerHTML = `<div class="container"><h1>Performance History</h1>
        <div class="card empty-state"><div class="big-icon">📊</div><p>No attempts yet.</p></div></div>`;
      return;
    }
    const scores = history.map(h => h.percentage);
    const best = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const latest = scores[scores.length - 1];
    const maxBarH = 120;
    const chart = history.slice(-12).map(h => {
      const h_ = Math.max(4, (h.percentage / 100) * maxBarH);
      return `<div class="bar-col"><div class="bar" style="height:${h_}px" title="${Fmt.pct(h.percentage)}"></div><div class="bar-label">${Fmt.escapeHtml((h.paperName||'').slice(0,8))}</div></div>`;
    }).join('');

    this.root.innerHTML = `
      <div class="container">
        <h1>Performance History</h1>
        <div class="results-grid">
          <div class="box"><div class="n">${Fmt.pct(best)}</div><div class="l">Best Score</div></div>
          <div class="box"><div class="n">${Fmt.pct(avg)}</div><div class="l">Average Score</div></div>
          <div class="box"><div class="n">${Fmt.pct(latest)}</div><div class="l">Latest Score</div></div>
          <div class="box"><div class="n">${history.length}</div><div class="l">Total Attempts</div></div>
        </div>
        <div class="card">
          <div class="section-title" style="margin-top:0;">Scores across attempts</div>
          <div class="chart-bars">${chart}</div>
        </div>
        <div class="section-title">All Attempts</div>
        <div class="card history-table-wrap">
          <table class="topic-table">
            <thead><tr><th>Paper</th><th>Mode</th><th>Date</th><th>Score</th><th>Correct</th><th>Incorrect</th><th>Unanswered</th><th>Accuracy</th><th>Time</th><th></th></tr></thead>
            <tbody>
              ${history.slice().reverse().map(h => `
                <tr>
                  <td>${Fmt.escapeHtml(h.paperName)}</td>
                  <td>${h.mode === 'exam' ? '📝 Exam' : '📚 Practice'}</td>
                  <td>${Fmt.dateShort(h.date)}</td>
                  <td>${h.score}/${h.maxScore}</td>
                  <td>${h.correct}</td>
                  <td>${h.incorrect}</td>
                  <td>${h.unanswered}</td>
                  <td>${Fmt.pct(h.accuracy)}</td>
                  <td>${Fmt.hms(h.timeTakenSec)}</td>
                  <td><a href="#/review/${h.paperId}?attempt=${h.id}">Review</a></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="action-row">
          <button class="btn btn-outline" id="export-history-btn">⬇ Export history (for sharing)</button>
        </div>
      </div>`;

    document.getElementById('export-history-btn').addEventListener('click', () => this.exportHistory(history));
  },

  exportHistory(history) {
    const lines = history.map(h =>
      `${Fmt.dateShort(h.date)} | ${h.paperName} | ${h.mode} | Score: ${h.score}/${h.maxScore} (${Fmt.pct(h.percentage)}) | Correct: ${h.correct} Incorrect: ${h.incorrect} Unanswered: ${h.unanswered} | Accuracy: ${Fmt.pct(h.accuracy)} | Time: ${Fmt.hms(h.timeTakenSec)}`
    );
    const summary = `MCQ Practice/Exam — Performance Export\nGenerated: ${new Date().toLocaleString()}\nTotal attempts: ${history.length}\n\n` + lines.join('\n');
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'performance-history.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  renderSettings() {
    const settings = Store.getSettings();
    this.root.innerHTML = `
      <div class="container">
        <h1>Settings</h1>
        <div class="card">
          <div class="settings-row">
            <div>
              <strong>Negative marking override</strong>
              <div class="text-muted" style="font-size:0.85rem;">Each paper defines its own scoring rule. This lets you force it on/off across all papers for testing — leave on "Paper default" normally.</div>
            </div>
            <div class="pill-toggle" id="neg-toggle">
              <button data-v="null" class="${settings.negativeMarkingOverride === null ? 'active' : ''}">Paper default</button>
              <button data-v="true" class="${settings.negativeMarkingOverride === true ? 'active' : ''}">Force On</button>
              <button data-v="false" class="${settings.negativeMarkingOverride === false ? 'active' : ''}">Force Off</button>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <strong>Clear all local data</strong>
              <div class="text-muted" style="font-size:0.85rem;">Removes all saved history and in-progress attempts from this browser. Cannot be undone.</div>
            </div>
            <button class="btn btn-secondary" id="clear-data-btn">Clear Data</button>
          </div>
        </div>
      </div>`;

    document.querySelectorAll('#neg-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.v === 'null' ? null : (btn.dataset.v === 'true');
        Store.setSettings({ negativeMarkingOverride: v });
        App.renderSettings();
      });
    });
    document.getElementById('clear-data-btn').addEventListener('click', () => {
      if (confirm('This will permanently delete all saved history and progress on this device. Continue?')) {
        localStorage.clear();
        App.renderSettings();
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
