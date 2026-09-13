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

  async getManifest() {
    if (this._manifestCache) return this._manifestCache;
    const res = await fetch('papers/manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load papers/manifest.json (HTTP ' + res.status + ')');
    const data = await res.json();
    this._manifestCache = data.papers || [];
    return this._manifestCache;
  },

  async getPaper(paperId) {
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
