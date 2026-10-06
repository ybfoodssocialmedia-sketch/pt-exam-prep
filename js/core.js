/* core.js — storage, paper loading, scoring, shared helpers */

const Store = {
  KEYS: {
    HISTORY: 'mcq_history_v1',
    ACTIVE_EXAM: 'mcq_active_exam_v1',
    PRACTICE_PREFIX: 'mcq_practice_v1_',
    SETTINGS: 'mcq_settings_v1'
  },

  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Storage read failed for', key, e);
      return fallback;
    }
  },
  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write failed for', key, e);
      return false;
    }
  },

  getHistory() { return this._get(this.KEYS.HISTORY, []); },
  addHistoryEntry(entry) {
    const h = this.getHistory();
    h.push(entry);
    this._set(this.KEYS.HISTORY, h);
  },
  getHistoryForPaper(paperId) {
    return this.getHistory().filter(h => h.paperId === paperId);
  },

  getActiveExam() { return this._get(this.KEYS.ACTIVE_EXAM, null); },
  setActiveExam(state) { this._set(this.KEYS.ACTIVE_EXAM, state); },
  clearActiveExam() { try { localStorage.removeItem(this.KEYS.ACTIVE_EXAM); } catch (e) {} },

  getPracticeState(paperId) { return this._get(this.KEYS.PRACTICE_PREFIX + paperId, null); },
  setPracticeState(paperId, state) { this._set(this.KEYS.PRACTICE_PREFIX + paperId, state); },
  clearPracticeState(paperId) { try { localStorage.removeItem(this.KEYS.PRACTICE_PREFIX + paperId); } catch (e) {} },

  // Subject-practice questions already served on this device (so new sessions prefer unseen ones)
  getSeen() { return this._get('mcq_seen_v1', {}); },
  markSeen(keys) { const s = this.getSeen(); keys.forEach(k => { s[k] = 1; }); this._set('mcq_seen_v1', s); },

  getSettings() { return this._get(this.KEYS.SETTINGS, { negativeMarkingOverride: null }); },
  setSettings(s) { this._set(this.KEYS.SETTINGS, s); }
};

const Papers = {
  _manifestCache: null,
  _paperCache: {},
  SUBJECT_POOL_PREFIX: 'subject:',
  SUBJECT_TOPIC_SEP: '::',

  async getManifest() {
    if (this._manifestCache) return this._manifestCache;
    const res = await fetch('papers/manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load papers/manifest.json (HTTP ' + res.status + ')');
    const data = await res.json();
    this._manifestCache = data.papers || [];
    return this._manifestCache;
  },

  isSubjectPoolId(id) { return typeof id === 'string' && id.startsWith(this.SUBJECT_POOL_PREFIX); },

  parseSubjectPoolId(id) {
    const rest = id.slice(this.SUBJECT_POOL_PREFIX.length);
    const sepIdx = rest.indexOf(this.SUBJECT_TOPIC_SEP);
    if (sepIdx === -1) return { subject: rest, topic: null };
    return { subject: rest.slice(0, sepIdx), topic: rest.slice(sepIdx + this.SUBJECT_TOPIC_SEP.length) };
  },

  makeSubjectPoolId(subject, topic) {
    return this.SUBJECT_POOL_PREFIX + subject + (topic ? this.SUBJECT_TOPIC_SEP + topic : '');
  },

  async getPaper(paperId, opts = {}) {
    if (this.isSubjectPoolId(paperId)) {
      // A subject/topic session is a random sample of SUBJECT_SESSION_SIZE questions. Once a
      // session exists its question ids are saved in the practice state (opts.onlyIds) so a
      // page reload resumes the same questions instead of re-rolling them.
      if (!opts.fresh && !opts.onlyIds && this._paperCache[paperId]) return this._paperCache[paperId];
      const { subject, topic } = this.parseSubjectPoolId(paperId);
      const pool = await this.buildSubjectPool(subject, topic, opts);
      this._paperCache[paperId] = pool;
      return pool;
    }
    if (this._paperCache[paperId]) return this._paperCache[paperId];
    const manifest = await this.getManifest();
    const meta = manifest.find(p => p.id === paperId);
    if (!meta) throw new Error('Paper "' + paperId + '" is not listed in manifest.json');
    const res = await fetch('papers/' + meta.file, { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load papers/' + meta.file + ' (HTTP ' + res.status + ')');
    const data = await res.json();
    const validated = this._validateAndClean(data, meta);
    this._paperCache[paperId] = validated;
    return validated;
  },

  // Loads a paper for results/review screens: a subject session must reload the SAME
  // questions that were served, which practice state remembers in poolIds.
  async getPaperResumed(paperId) {
    if (this.isSubjectPoolId(paperId)) {
      const st = Store.getPracticeState(paperId);
      if (st && st.poolIds) return this.getPaper(paperId, { onlyIds: st.poolIds });
    }
    return this.getPaper(paperId);
  },

  SUBJECT_SESSION_SIZE: 20,

  // papers/bank/index.json (written by tools/compose_papers.py): per-subject counts + topics,
  // so the picker needs one tiny request instead of loading every question.
  async getBankIndex() {
    if (this._bankIndexCache) return this._bankIndexCache;
    const res = await fetch('papers/bank/index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load papers/bank/index.json (HTTP ' + res.status + ')');
    this._bankIndexCache = (await res.json()).subjects || [];
    return this._bankIndexCache;
  },

  // Returns [{ subject, count, topics: [{ topic, count }] }], sorted by subject name.
  async getSubjectSummary() {
    return this.getBankIndex();
  },

  async _loadSubjectQuestions(subject) {
    const index = await this.getBankIndex();
    const entry = index.find(s => s.subject === subject);
    if (!entry) return [];
    this._bankFileCache = this._bankFileCache || {};
    const all = [];
    for (const file of entry.files) {
      if (!this._bankFileCache[file]) {
        const res = await fetch('papers/bank/' + file, { cache: 'no-store' });
        if (!res.ok) throw new Error('Could not load papers/bank/' + file + ' (HTTP ' + res.status + ')');
        this._bankFileCache[file] = await res.json();
      }
      const data = this._bankFileCache[file];
      (data.questions || []).forEach(q => {
        const subj = q.subject || data.subject;
        if (subj === subject) all.push(Object.assign({}, q, { subject: subj, _file: file }));
      });
    }
    return all;
  },

  _qKey(q) { return q._file + '::' + q.id; },

  // A subject (or subject + topic) practice session: SUBJECT_SESSION_SIZE random questions,
  // preferring ones this device has not served before, so repeated sessions walk through the
  // whole bank before anything repeats.
  async buildSubjectPool(subject, topic, opts = {}) {
    let questions = await this._loadSubjectQuestions(subject);
    if (topic) questions = questions.filter(q => (q.topic || 'General') === topic);
    let chosen;
    if (opts.onlyIds) {
      const byId = {};
      questions.forEach(q => { byId[this._qKey(q)] = q; });
      chosen = opts.onlyIds.map(id => byId[id]).filter(Boolean);
    } else {
      const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
      const seen = Store.getSeen();
      const unseen = shuffle(questions.filter(q => !seen[this._qKey(q)]));
      const seenQs = shuffle(questions.filter(q => seen[this._qKey(q)]));
      chosen = shuffle(unseen.concat(seenQs).slice(0, this.SUBJECT_SESSION_SIZE));
      Store.markSeen(chosen.map(q => this._qKey(q)));
    }
    const label = topic ? (subject + ' — ' + topic) : subject;
    const clean = this._validateAndClean({
      paperId: this.makeSubjectPoolId(subject, topic),
      questions: chosen.map(q => Object.assign({}, q, { id: this._qKey(q) }))
    }, { id: this.makeSubjectPoolId(subject, topic), subject });
    return Object.assign(clean, {
      paperName: label + ' (' + chosen.length + ' questions)',
      description: 'A random set of ' + chosen.length + ' questions on ' + label + '.',
      isSubjectPool: true,
      poolIds: chosen.map(q => this._qKey(q))
    });
  },

  // Defensive cleanup so one malformed question can't break the whole paper (spec 3.12)
  _validateAndClean(paper, meta) {
    const seen = new Set();
    const cleanQuestions = [];
    const problems = [];
    (paper.questions || []).forEach((q, idx) => {
      if (q == null || typeof q !== 'object') { problems.push('Question at index ' + idx + ' is not an object — skipped.'); return; }
      if (q.id == null) { problems.push('Question at index ' + idx + ' has no id — skipped.'); return; }
      if (seen.has(q.id)) { problems.push('Duplicate question id ' + q.id + ' — later copy skipped.'); return; }
      if (!q.options || !q.correctAnswer || !q.options[q.correctAnswer]) {
        problems.push('Question ' + q.id + ' has invalid options/correctAnswer — skipped.');
        return;
      }
      seen.add(q.id);
      cleanQuestions.push({
        id: q.id,
        subject: q.subject || meta.subject || 'General',
        topic: q.topic || 'General',
        subtopic: q.subtopic || '',
        difficulty: q.difficulty || 'Medium',
        question: q.question || '(Question text missing)',
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || 'No explanation available for this question yet.',
        sourceBook: q.sourceBook || null,
        sourceChapter: q.sourceChapter || null,
        sourcePage: (q.sourcePage === undefined) ? null : q.sourcePage
      });
    });
    if (problems.length) console.warn('Paper "' + paper.paperId + '" data issues:\n - ' + problems.join('\n - '));
    return {
      paperId: paper.paperId || meta.id,
      paperName: paper.paperName || meta.name,
      subject: paper.subject || meta.subject,
      description: paper.description || meta.description || '',
      durationMinutes: paper.durationMinutes || 90,
      scoring: Object.assign({ correct: 1, incorrect: 0, unanswered: 0, negativeMarkingEnabled: false }, paper.scoring || {}),
      questions: cleanQuestions,
      dataIssues: problems
    };
  }
};

const Fmt = {
  mmss(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  },
  hms(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
    return m + 'm ' + sec + 's';
  },
  pct(n) { return (Math.round(n * 10) / 10).toFixed(1) + '%'; },
  dateShort(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
           d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  },
  escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
};

const Scoring = {
  scoreAttempt(paper, answers) {
    const rule = paper.scoring;
    let correct = 0, incorrect = 0, unanswered = 0, rawScore = 0;
    const perQuestion = {};
    paper.questions.forEach(q => {
      const given = answers[q.id];
      if (given === undefined || given === null || given === '') {
        unanswered++;
        rawScore += (rule.unanswered || 0);
        perQuestion[q.id] = { status: 'unanswered' };
      } else if (given === q.correctAnswer) {
        correct++;
        rawScore += (rule.correct || 0);
        perQuestion[q.id] = { status: 'correct' };
      } else {
        incorrect++;
        rawScore += rule.negativeMarkingEnabled ? (rule.incorrect || 0) : 0;
        perQuestion[q.id] = { status: 'incorrect' };
      }
    });
    const total = paper.questions.length;
    const maxScore = total * (rule.correct || 1);
    return {
      total, correct, incorrect, unanswered,
      score: Math.round(rawScore * 100) / 100,
      maxScore,
      accuracy: (correct + incorrect) > 0 ? (correct / (correct + incorrect)) * 100 : 0,
      percentage: maxScore > 0 ? (rawScore / maxScore) * 100 : 0,
      perQuestion
    };
  },

  topicBreakdown(paper, answers) {
    const byTopic = {};
    paper.questions.forEach(q => {
      const key = q.topic || 'General';
      if (!byTopic[key]) byTopic[key] = { topic: key, attempted: 0, correct: 0, total: 0 };
      byTopic[key].total++;
      const given = answers[q.id];
      if (given !== undefined && given !== null && given !== '') {
        byTopic[key].attempted++;
        if (given === q.correctAnswer) byTopic[key].correct++;
      }
    });
    return Object.values(byTopic).map(t => ({
      ...t,
      accuracy: t.attempted > 0 ? (t.correct / t.attempted) * 100 : 0
    })).sort((a, b) => b.total - a.total);
  }
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
