# Build Plan & Status

## What the app is
Offline-capable MCQ simulator for PGP-CET (physiotherapy PG entrance) preparation. Static site (no build step), hosted on GitHub Pages. Two modes:
- **Practice** — one question at a time, instant feedback + explanation + source.
- **Exam** — 100 questions, 90-minute timer, no feedback until submission, auto-submit, survives reload.

## Content structure (current)
- `papers/bank/*.json` — the **question bank** (one or more files per subject). Every question has: topic, subtopic, difficulty (Easy/Medium/Hard), four options, correct answer, explanation, source book + chapter. `papers/bank/index.json` is generated and lists subjects/topics/counts.
- `papers/generated/{easy,medium,hard}-paper-N.json` — **100-question papers** built by `tools/compose_papers.py` to follow the real PGP-CET 2025 subject weightage (Anatomy 4, Physiology 4, Biochem 2, Exercise Therapy 5, Electro Therapy+Electrical Agents 12, Pharm 2, Path & Micro 4, Psychology 1, Psychiatry 1, Kinesio 7, Surgery/Ortho 6, Medicine 6, OBGY 3, Physical Diagnosis 8, PT-MSK 10, PT-Neuro 10, PT-GenMed 10, PT-Community 5).
- **Papers are frozen once published** (a "Solved" tick and history never point at a changed paper). Question *text* is refreshed from the bank on every compose, so corrections reach published papers; selection/order do not change.
- **Practice by Subject / topic** — random 20-question sessions drawn from the bank (unseen-first), not tied to papers.
- Tier label (Easy/Medium/Hard) comes from the *actual* difficulty mix of each paper (mean difficulty), where per-question difficulty is the author's tag.

## How to add questions
1. Write a batch file (tuple format — see the docstring in `tools/add_batch.py`; correct option goes first, the script shuffles letters).
2. `python tools/add_batch.py <batch.py>` — appends to the right bank file with auto ids, drops duplicates/invalid items.
3. `python tools/compose_papers.py` — rebuilds `bank/index.json`, refreshes published papers, and builds any new papers the bank now supports (full weightage met, ≤5 reused questions, any two papers share ≤5).
4. Commit + push.
Interpreter: `C:\Users\Lenovo\AppData\Local\Programs\Python\Python312\python.exe` (stdlib only).

## Sourcing / honesty notes
- The first ~313 questions were drafted directly from the uploaded textbooks (chapter-level citations, no invented page numbers).
- Later batches were written from standard textbook knowledge, using the uploaded MPT MCQ book (Suraj Kumar, *MCQs for MPT Entrance Examination*, 2e) only as a **topic/high-yield guide** — questions are original wording, not copied. Citations for those are chapter/reference-level and are **not page-verified**.
- The Khayti Shah question bank (scanned PDF) has not been used yet.

## Status (latest)
- Bank: ~2,750 questions across 18 subjects.
- 24 full papers live (7 Easy / 9 Medium / 8 Hard); max 2 shared questions between any two.
- Target: 20 papers per tier (60). Binding shortages are the heavily-weighted subjects (Electro Therapy 12/paper; PT-MSK, PT-Neuro, PT-GenMed 10/paper each; Kinesio; Physical Diagnosis).

## Ideas / next
- More questions for the binding subjects above, then re-run the composer.
- A factual review pass of newly written batches (a first pass over everything written so far was done; two items corrected).
- Optionally use the Khayti Shah bank as a further topic guide (needs page-by-page reading — it is scanned).
