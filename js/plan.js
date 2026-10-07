/* plan.js — 20-day study timetable (learning + revision, separate from question solving) */

const PlanData = {
  rhythm: [
    ['Block 1', '2.5 h', 'New topic A — read and make notes'],
    ['Block 2', '2.5 h', 'New topic B — read and make notes'],
    ['Block 3', '1 h', 'Recap yesterday and 3 days ago from memory (no notes)'],
    ['Block 4', '30 min', 'One-page "numbers and lists" sheet for the day']
  ],
  // [subject tag, title, details]
  learn: [
    { a: ['Electro Therapy', 'Electro I', 'Physics, current types, Ohm\'s law, strength-duration curve, TENS, interferential current'],
      b: ['Kinesiology', 'Kinesiology I', 'Levers, joint classification, close- and loose-packed positions, arthrokinematics'],
      n: 'Close/loose-packed positions, TENS parameters, current frequency ranges' },
    { a: ['Electro Therapy', 'Electro II', 'SWD, microwave, ultrasound, infrared, UV, laser, wax, cryotherapy, traction'],
      b: ['Kinesiology', 'Kinesiology II', 'Upper limb muscle actions, scapulohumeral rhythm, gait cycle and deviations'],
      n: 'US/SWD doses and penetration, UV erythema doses, gait percentages' },
    { a: ['Electro Therapy', 'Electro III', 'EMG, nerve conduction, SD curve, iontophoresis, biofeedback, FES, compression'],
      b: ['Kinesiology', 'Kinesiology III', 'Lower limb and spine mechanics, posture, breathing mechanics'],
      n: 'Iontophoresis ions, EMG sounds, chronaxie and rheobase, spinal coupling rules' },
    { a: ['PT Musculoskeletal', 'PT-MSK I', 'Shoulder, elbow, wrist and hand conditions, fracture healing, rehab protocols'],
      b: ['Physical Diagnosis', 'Physical Diagnosis I', 'Normal ROM, MMT grades, end-feel, capsular patterns, dermatomes and myotomes'],
      n: 'Normal ROM table, capsular patterns, dermatomes and myotomes' },
    { a: ['PT Musculoskeletal', 'PT-MSK II', 'Spine, hip, knee, ankle and foot, amputation, prosthetics, orthotics'],
      b: ['Physical Diagnosis', 'Physical Diagnosis II', 'Special tests by joint, neural tension tests, Maitland and Kaltenborn grades, McKenzie'],
      n: 'Special test to condition list, Maitland and Kaltenborn grades' },
    { a: ['PT Neurosciences', 'PT-Neuro I', 'Neuroanatomy and tracts, stroke, TBI, Brunnstrom, Bobath, PNF, motor learning'],
      b: ['Anatomy', 'Anatomy I', 'Brain, cranial nerves, brachial plexus, upper limb nerves'],
      n: 'Brunnstrom stages, Rancho levels, GCS, brachial plexus branches' },
    { a: ['PT Neurosciences', 'PT-Neuro II', 'Spinal cord injury, peripheral nerve injury, Parkinson\'s, MS, GBS, cerebral palsy, reflexes, milestones, balance scales'],
      b: ['Anatomy', 'Anatomy II', 'Lower limb nerves, hip, knee and ankle joints, thorax'],
      n: 'Reflex ages, milestones, ASIA grades, balance scale cut-offs' },
    { a: ['PT General Medical', 'PT-GenMed I', 'ECG, MI, cardiac rehab phases, exercise prescription, heart failure, vascular disease'],
      b: ['Physiology', 'Physiology I', 'Cardiovascular and respiratory physiology'],
      n: 'ECG intervals, Borg scale, METs, lung volumes and capacities' },
    { a: ['PT General Medical', 'PT-GenMed II', 'PFTs, ABG, chest physiotherapy, COPD, ventilators, burns, wounds, geriatrics, women\'s health'],
      b: ['Physiology', 'Physiology II', 'Nerve and muscle, exercise physiology, renal, endocrine'],
      n: 'ABG patterns, PFT patterns, burn percentages, pressure ulcer stages' },
    { a: ['Surgery and Ortho', 'Surgery and Ortho I', 'Fracture classifications, dislocations, bone tumours, infections, paediatric ortho'],
      b: ['Exercise Therapy', 'Exercise Therapy I', 'Muscle fibre types, energy systems, strength training, DeLorme and Oxford protocols'],
      n: 'Eponymous fractures and signs, PRE protocol percentages' },
    { a: ['Exercise Therapy', 'Exercise Therapy II', 'Stretching, balance training, relaxation, aquatic therapy, gait aids, wheelchairs'],
      b: ['Surgery and Ortho', 'Surgery general', 'Burns, wounds, grafts, amputations'],
      n: 'Wheelchair dimensions, crutch/cane measurement, aquatic temperatures' },
    { a: ['Medicine', 'Medicine I', 'Cardiac, respiratory, GI, endocrine'],
      b: ['Pathology', 'Pathology', 'Cell injury, inflammation, healing, neoplasia, haematology'],
      n: 'Normal lab values, tumour markers, types of necrosis' },
    { a: ['Medicine', 'Medicine II', 'Neurology, kidney, rheumatology, infections, nutrition'],
      b: ['Micro and Pharma', 'Microbiology and Pharmacology', 'Immunity, sterilisation, key infections; common drug classes and side effects'],
      n: 'Vitamin deficiency diseases, drug to side-effect pairs, causative organisms' },
    { a: ['Community Health', 'Community Health', 'Epidemiology, biostatistics, research design, levels of prevention, ICF and CBR, immunisation'],
      b: ['Basic Sciences', 'OBGY, Biochemistry, Psychology, Psychiatry', 'One short pass each of the four small subjects'],
      n: 'Statistics definitions, vaccine schedule, pregnancy changes, key enzymes' }
  ],
  revise: [
    { title: 'Revise: Electro Therapy, Kinesiology, Exercise Therapy', items: ['Electro Therapy notes and number sheets', 'Kinesiology notes and number sheets', 'Exercise Therapy notes and number sheets'] },
    { title: 'Revise: PT-MSK, Physical Diagnosis, Surgery and Ortho', items: ['PT-MSK notes', 'Physical Diagnosis tables and special tests', 'Surgery and Ortho notes'] },
    { title: 'Revise: PT-Neuro, PT-GenMed, Medicine', items: ['PT-Neuro notes, scales and reflexes', 'PT-GenMed notes, ECG, PFT, ABG patterns', 'Medicine notes and lab values'] },
    { title: 'Revise: Community Health and basic sciences', items: ['Community Health and biostatistics', 'Anatomy, Physiology, Pathology, Microbiology', 'Pharmacology, Biochemistry, OBGY, Psychology, Psychiatry'] },
    { title: 'Rapid revision: number sheets and weak areas', items: ['Go through every daily "numbers and lists" sheet', 'Your running mistakes page from question solving', 'Re-read the weakest two subjects'] },
    { title: 'Light day: skim and rest', items: ['Skim mind maps and summary notes only', 'No new topics', 'Prepare exam day items and sleep early'] }
  ]
};

const PlanView = {
  KEY: 'mcq_plan_v1',

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || { done: {}, start: null, open: null }; }
    catch (e) { return { done: {}, start: null, open: null }; }
  },
  save(state) { try { localStorage.setItem(this.KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } },

  buildDays() {
    const days = [];
    PlanData.learn.forEach((d, i) => {
      const n = i + 1;
      const recapText = n === 1
        ? 'Recap today\'s notes from memory, then fix gaps'
        : (n > 3 ? 'Recap Day ' + (n - 1) + ' and Day ' + (n - 3) + ' topics from memory' : 'Recap Day ' + (n - 1) + ' topics from memory');
      days.push({
        day: n, kind: 'learn', title: d.a[1] + ' + ' + d.b[1],
        tasks: [
          { id: 'd' + n + 'a', tag: d.a[0], label: d.a[1], detail: d.a[2], time: '2.5 h' },
          { id: 'd' + n + 'b', tag: d.b[0], label: d.b[1], detail: d.b[2], time: '2.5 h' },
          { id: 'd' + n + 'c', tag: 'Recall', label: 'Recap', detail: recapText, time: '1 h' },
          { id: 'd' + n + 'n', tag: 'Numbers', label: 'Numbers and lists sheet', detail: d.n, time: '30 min' }
        ]
      });
    });
    PlanData.revise.forEach((r, i) => {
      const n = 15 + i;
      days.push({
        day: n, kind: 'revise', title: r.title,
        tasks: r.items.map((t, j) => ({ id: 'd' + n + 'r' + j, tag: 'Revise', label: t, detail: '', time: j === 2 ? '1.5 h' : '2 h' }))
      });
    });
    return days;
  },

  render() {
    const days = this.buildDays();
    const state = this.load();
    const total = days.reduce((s, d) => s + d.tasks.length, 0);
    const doneCount = days.reduce((s, d) => s + d.tasks.filter(t => state.done[t.id]).length, 0);
    const pct = Math.round(doneCount * 100 / total);
    const todayDay = this.todayDay(state.start);
    const firstOpen = days.find(d => d.tasks.some(t => !state.done[t.id]));
    const openDay = state.open || todayDay || (firstOpen ? firstOpen.day : 1);

    const dayHtmlList = days.map(d => {
      const dn = d.tasks.filter(t => state.done[t.id]).length;
      const complete = dn === d.tasks.length;
      const isOpen = d.day === openDay;
      return `
        <div class="plan-day ${complete ? 'complete' : ''} ${d.day === todayDay ? 'today' : ''}" data-day="${d.day}">
          <button class="plan-day-head" data-toggle="${d.day}" aria-expanded="${isOpen}">
            <span class="plan-day-num">Day ${d.day}</span>
            <span class="plan-day-title">${Fmt.escapeHtml(d.title)}</span>
            ${d.day === todayDay ? '<span class="plan-today-tag">Today</span>' : ''}
            <span class="plan-day-count">${complete ? '✓ Done' : dn + '/' + d.tasks.length}</span>
          </button>
          <div class="plan-tasks" ${isOpen ? '' : 'hidden'}>
            ${d.tasks.map(t => `
              <label class="plan-task ${state.done[t.id] ? 'done' : ''}">
                <input type="checkbox" data-task="${t.id}" ${state.done[t.id] ? 'checked' : ''}>
                <span class="plan-task-body">
                  <span class="plan-task-top"><span class="plan-chip">${Fmt.escapeHtml(t.tag)}</span><span class="plan-time">${t.time}</span></span>
                  <span class="plan-task-label">${Fmt.escapeHtml(t.label)}</span>
                  ${t.detail ? `<span class="plan-task-detail">${Fmt.escapeHtml(t.detail)}</span>` : ''}
                </span>
              </label>`).join('')}
          </div>
        </div>`;
    });

    App.root.innerHTML = `
      <div class="container">
        <h1 style="margin-bottom:4px;">20-Day Study Plan</h1>
        <p class="text-muted" style="margin-top:0;">Learning and revision only — question solving is separate. Tick each task when done.</p>

        <div class="card plan-summary">
          <div class="plan-summary-top">
            <strong>${doneCount} of ${total} tasks done</strong><span>${pct}%</span>
          </div>
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          <div class="plan-tools">
            <label class="plan-start">Start date
              <input type="date" id="plan-start" value="${state.start || ''}">
            </label>
            <button class="btn btn-secondary plan-reset" id="plan-reset">Reset ticks</button>
          </div>
          <details class="plan-rhythm">
            <summary>Daily rhythm (Days 1–14)</summary>
            <table>${PlanData.rhythm.map(r => `<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${Fmt.escapeHtml(r[2])}</td></tr>`).join('')}</table>
          </details>
        </div>

        <div class="plan-section-label">Days 1–14: learn</div>
        ${dayHtmlList.slice(0, 14).join('')}
        <div class="plan-section-label">Days 15–20: revise</div>
        ${dayHtmlList.slice(14).join('')}
      </div>`;
    this.bind(days);
  },

  todayDay(start) {
    if (!start) return null;
    const diff = Math.floor((new Date(new Date().toDateString()) - new Date(start + 'T00:00:00')) / 86400000);
    return diff >= 0 && diff < 20 ? diff + 1 : null;
  },

  bind() {
    const root = App.root;
    root.querySelectorAll('input[data-task]').forEach(cb => {
      cb.addEventListener('change', () => {
        const s = this.load();
        if (cb.checked) s.done[cb.dataset.task] = 1; else delete s.done[cb.dataset.task];
        const dayEl = cb.closest('.plan-day');
        s.open = parseInt(dayEl.dataset.day, 10);
        this.save(s);
        this.render();
      });
    });
    root.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.nextElementSibling;
        const open = panel.hasAttribute('hidden');
        if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', String(open));
      });
    });
    document.getElementById('plan-start').addEventListener('change', (e) => {
      const s = this.load(); s.start = e.target.value || null; s.open = null; this.save(s); this.render();
    });
    document.getElementById('plan-reset').addEventListener('click', () => {
      if (!confirm('Clear all ticks in the study plan?')) return;
      const s = this.load(); s.done = {}; s.open = null; this.save(s); this.render();
    });
  }
};
