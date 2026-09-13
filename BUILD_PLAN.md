# Build Plan — Mass Content Generation (in progress)

**Directive from user (2026-09-14):** Build at least 20 Practice Sets (20 questions each) per difficulty tier — Easy / Medium / Hard — so 60 papers total, mixed across all subjects. Up to 5% overlap between any two papers of the same tier is acceptable (≈1 shared question per 20), but the goal is to keep the shared question bank large enough (~400 real questions per tier, ~1200 total) that most papers end up fully disjoint. The flagship real 100-question weighted Mock Exam (matching actual PGP-CET topic weightage) is a SEPARATE deliverable, not part of this 60-paper count.

**No fabrication rule still applies in full.** Every question must trace to an actual page/chapter in an uploaded book. Nothing here is generated to hit a number at the expense of that rule — if a subject runs out of real coverage before its share is done, that's fine, it's covered elsewhere or left for more material later.

## How this works
- Question bank: `papers/bank/<subject-slug>.json` — one file per subject, each holding an array of full question objects (with `difficulty` set to Easy/Medium/Hard).
- Composer: `tools/compose_papers.py` — reads the whole bank, groups by difficulty, cuts into 20-question papers (disjoint where possible), writes `papers/generated/*.json`, and rewrites the generated-paper entries in `manifest.json`. Safe to re-run any time the bank grows — fully regenerates from current state. Run with the Python 3.12 interpreter at `C:\Users\Lenovo\AppData\Local\Programs\Python\Python312\python.exe` (has no extra deps, plain stdlib).
- Progress is committed and pushed after every meaningful batch so nothing is lost across session boundaries.

## Source quality reference (so pacing/care matches risk)
- Clean digital text (fast, low-risk): Daniels & Worthingham, Kisner & Colby, Sullivan, Pryor, KD Tripathi, Harsh Mohan Pathology, Dutta Obstetrics, Bailey & Love Surgery, Davidson's Medicine, Ahuja Psychiatry, Morgan & King Psychology, BD Chaurasia Anatomy (Upper+Lower).
- OCR noise, needs care (medium-risk, verify each fact): Magee Orthopedic Assessment, AK Jain Physiology, Satyanarayana Biochemistry.
- Scanned, no text layer — render page to PNG via pymupdf then read visually (slow, page-by-page): Clayton Electrotherapy (8th/9th ed), Park's PSM.
  - Render command: `"C:\Users\Lenovo\AppData\Local\Programs\Python\Python312\python.exe" "D:\Claude\scratch_ocr\render_page.py" "<pdf path>" <page_num> "<out.png>" 200`

## Progress tracker (update after every batch)

| Subject | Bank file | Easy | Medium | Hard | Notes |
|---|---|---|---|---|---|
| Physical Diagnosis & Manipulative Skills | (from validation-batch-1, not yet split into bank) | - | - | - | 8 questions exist, need difficulty tags + move to bank format |
| Fundamentals of Exercise Therapy | (from validation-batch-1) | - | - | - | 6 questions exist, same as above |
| Anatomy | anatomy.json | 0 | 0 | 0 | Source: BD Chaurasia Upper+Lower |
| Physiology | physiology.json | 0 | 0 | 0 | Source: AK Jain (verify each page) |
| Biochemistry | biochemistry.json | 0 | 0 | 0 | Source: Satyanarayana (verify each page) |
| Pharmacology | pharmacology.json | 0 | 0 | 0 | Source: KD Tripathi |
| Pathology & Microbiology | pathology.json | 0 | 0 | 0 | Source: Harsh Mohan |
| Psychology | psychology.json | 0 | 0 | 0 | Source: Morgan & King |
| Psychiatry | psychiatry.json | 0 | 0 | 0 | Source: Ahuja |
| Kinesio Therapeutics | kinesio.json | 0 | 0 | 0 | Source: Kisner, Daniels |
| Fundamentals of Electro Therapy / Electrical Agents | electrotherapy.json | 0 | 0 | 0 | Source: Clayton (render+vision) |
| General Surgery & Orthopedics | surgery-ortho.json | 0 | 0 | 0 | Source: Bailey & Love, Magee |
| Medicine | medicine.json | 0 | 0 | 0 | Source: Davidson's |
| OBGY | obgy.json | 0 | 0 | 0 | Source: Dutta |
| Physiotherapy in MSK Condition | pt-msk.json | 0 | 0 | 0 | Source: Magee, Kisner |
| Physiotherapy in Neurosciences | pt-neuro.json | 0 | 0 | 0 | Source: Sullivan |
| Physiotherapy in Gen. Medical/Surgical | pt-genmed.json | 0 | 0 | 0 | Source: Pryor, Davidson's |
| Physiotherapy in Community Health | pt-community.json | 0 | 0 | 0 | Source: Park's PSM (render+vision) |

**Target: ~400 Easy + ~400 Medium + ~400 Hard = ~1200 total bank questions, spread across subjects roughly matching real PGP-CET weightage.**

## Next up after mass bank build
1. Run composer once a meaningful chunk of the bank exists (don't wait for all 1200 — publish papers incrementally as soon as each 20-question chunk is ready, so the live app has real content throughout, not just at the very end).
2. Build the real 100-question weighted Mock Exam once each of the 19 topics has enough bank material to draw its exact real-weightage share from.
3. Final validation pass (Section 4.10 style) before calling any of this "done".
