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
- Tier label (Easy/Medium/Hard) is **relative**: `tools/rebalance_tiers.py` ranks the 60 papers by mean question difficulty (author's tags) and labels the easiest third Easy, the hardest third Hard. Papers that move tier get a new id; `manifest.json` `aliases` + `Store.migrateAliases` (js/core.js) carry any stored history/progress across.

## How to add questions
1. Write a batch file (tuple format — see the docstring in `tools/add_batch.py`; correct option goes first, the script shuffles letters).
2. `python tools/add_batch.py <batch.py>` — appends to the right bank file with auto ids, drops duplicates/invalid items.
3. `python tools/compose_papers.py` — rebuilds `bank/index.json`, refreshes published papers, and builds any new papers the bank now supports (full weightage met, ≤5 reused questions, any two papers share ≤5).
4. Commit + push.
Interpreter: `C:\Users\Lenovo\AppData\Local\Programs\Python\Python312\python.exe` (stdlib only).

## Sourcing / honesty notes
- ~310 questions were drafted directly from the uploaded textbooks (chapter-level citations, no invented page numbers).
- **MPT book import** (Suraj Kumar, *MCQs for MPT Entrance Examination*, 2e, Jaypee 2020): ~2,250 items were parsed from the text layer, de-duplicated, and each one judged by me (the book's printed answer key is unreliable; ~900 doubtful items were dropped). Kept items carry the book's own reference tags, not page-verified, and my own short explanations.
- **Khayti Shah question bank** (scanned, 142 pp): read page by page; ~2,300 MCQs were written from its content in the same format (the book's printed answers were checked against standard sources; contradictory or doubtful ones were dropped or corrected).
- Later batches were original questions from standard textbook knowledge (sourceBook says so).
- The repository is public, so the book-derived content is visible to anyone with the link.

## Status (latest)
- Bank: ~6,100 questions across 18 subjects.
- **60 full papers live: 20 Easy / 20 Medium / 20 Hard**, each 100 questions at the real PGP-CET weightage; max 2 shared questions between any two papers.
- `python tools/verify_papers.py` checks: every paper has 100 unique questions, 4 distinct options, a valid answer and the exact weightage.

## Ideas / next
- A further factual review pass of the Khayti-derived and original batches (difficulty tags are author judgement).
- More questions per subject so subject-wise practice has even more unseen questions.
