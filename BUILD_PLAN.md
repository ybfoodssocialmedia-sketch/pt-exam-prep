# Build Plan — Next Milestone

**Status: waiting.** Do not build until the user has uploaded all remaining reference books/syllabi and explicitly says "build".

## What ships in the next build pass

1. **Subject-wise / Topic-wise unlimited Practice pool** (Engine feature)
   - New "Practice by Subject" entry point alongside the existing paper list.
   - Pools questions across ALL loaded papers by `subject` (and optionally `topic`), not just one paper's fixed set.
   - No cap on question count — grows automatically as more papers/content are added later, no rebuild.
   - Reuses the existing Practice Mode UI/logic (immediate feedback, explanations, citations, palette) — only the question-selection source changes (cross-paper pool vs. single paper).
   - History entries for these sessions use a synthetic id, e.g. `subject:Anatomy`, so they show up in Performance History like any other attempt.

2. **Full real 100-question Mixed Mock Exam(s)**, built from whatever books the user has uploaded by then, following the real PGP-CET weightage (see conversation for the 19-topic table). Only genuinely book-sourced topics get real citations; any topic still lacking a source gets flagged rather than silently filled with unsourced content — to be confirmed with the user per topic if gaps remain.

3. Once (1) and (2) are done, review the already-live `validation-batch-1` paper's 14 questions for style/quality against the user's expectations before scaling further.

## Known open items carried forward
- Clayton Electrotherapy (8th & 9th ed) are both pure image scans, no text layer — need either OCR or a different electrotherapy reference before those 12 marks (Electrical Agents + Fund. of Electro Therapy) can be sourced.
- Magee (Orthopedic Physical Assessment) has OCR noise — usable, but needs extra care per question.
- No detailed MUHS unit/subtopic syllabus was provided — subtopic scope is being derived from each source book's own chapter structure (user-approved approach).
