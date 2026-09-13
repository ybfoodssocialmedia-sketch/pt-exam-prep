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

  async getPaper(paperId) {
    if (this._paperCache[paperId]) return this._paperCache[paperId];
    if (this.isSubjectPoolId(paperId)) {
      const { subject, topic } = this.parseSubjectPoolId(paperId);
      const pool = await this.buildSubjectPool(subject, topic);
      this._paperCache[paperId] = pool;
      return pool;
    }
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

  // Loads every real (non-throwaway-fixture) paper's full question set, for the
  // subject-wise practice pool. sample-mixed-1 is fictional test data and is
  // excluded via includeInSubjectPool:false in the manifest; everything else
  // (including validation-batch-1, which is real book-sourced content) counts.
  async getAllPoolablePapers() {
    if (this._poolablePapersCache) return this._poolablePapersCache;
    const manifest = await this.getManifest();
    const eligible = manifest.filter(m => m.includeInSubjectPool !== false);
    const papers = await Promise.all(eligible.map(m => this.getPaper(m.id).catch(err => {
      console.warn('Skipping paper "' + m.id + '" while building subject pool:', err);
      return null;
    })));
    this._poolablePapersCache = papers.filter(Boolean);
    return this._poolablePapersCache;
  },

  // Returns [{ subject, count, topics: [{ topic, count }] }] across all poolable papers,
  // sorted by subject name. Used to render the "Practice by Subject" picker.
  async getSubjectSummary() {
    const papers = await this.getAllPoolablePapers();
    const bySubject = {};
    papers.forEach(paper => {
      paper.questions.forEach(q => {
        const subj = q.subject || 'General';
        if (!bySubject[subj]) bySubject[subj] = { subject: subj, count: 0, topicsMap: {} };
        bySubject[subj].count++;
        const top = q.topic || 'General';
        bySubject[subj].topicsMap[top] = (bySubject[subj].topicsMap[top] || 0) + 1;
      });
    });
    return Object.values(bySubject).map(s => ({
      subject: s.subject,
      count: s.count,
      topics: Object.entries(s.topicsMap).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count)
    })).sort((a, b) => a.subject.localeCompare(b.subject));
  },

  // Builds a synthetic "paper" pooling every question tagged with the given subject
  // (and optionally topic) across all real papers, no matter which paper they live in.
  // No cap on question count — it simply includes everything available right now.
  async buildSubjectPool(subject, topic) {
    const papers = await this.getAllPoolablePapers();
    const pooled = [];
    papers.forEach(paper => {
      paper.questions.forEach(q => {
        if (q.subject !== subject) return;
        if (topic && q.topic !== topic) return;
        pooled.push(Object.assign({}, q, { id: paper.paperId + this.SUBJECT_TOPIC_SEP + q.id, _sourcePaperId: paper.paperId, _sourcePaperName: paper.paperName }));
      });
    });
    // Shuffle so repeated practice sessions on the same subject don't always run in the same order
    for (let i = pooled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pooled[i], pooled[j]] = [pooled[j], pooled[i]];
    }
    const label = topic ? (subject + ' — ' + topic) : subject;
    return {
      paperId: this.makeSubjectPoolId(subject, topic),
      paperName: label + ' (Subject Practice)',
      subject,
      description: 'All available questions for ' + label + ', pooled across every paper. Grows automatically as more content is added.',
      durationMinutes: 90,
      scoring: { correct: 1, incorrect: 0, unanswered: 0, negativeMarkingEnabled: false },
      questions: pooled,
      dataIssues: [],
      isSubjectPool: true
    };
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
