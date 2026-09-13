"""
Composer: reads every question bank file in papers/bank/*.json, groups all
questions by difficulty (Easy/Medium/Hard), and cuts them into 20-question
"Practice Set" papers with zero (or minimal, only-if-necessary) overlap
between any two papers of the same difficulty.

Deterministic: uses a fixed random seed so re-running after adding more bank
questions doesn't needlessly reshuffle previously-generated sets any more
than necessary. Safe to re-run any time the bank grows — it fully regenerates
papers/generated/*.json and the corresponding manifest entries.

Usage: python compose_papers.py
Run from anywhere; paths are relative to this script's location.
"""
import json
import os
import random
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK_DIR = os.path.join(ROOT, "papers", "bank")
OUT_DIR = os.path.join(ROOT, "papers", "generated")
MANIFEST_PATH = os.path.join(ROOT, "papers", "manifest.json")
PAPER_SIZE = 20
SEED = 42

DIFFICULTIES = ["Easy", "Medium", "Hard"]


def slugify(s):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.strip().lower())
    return re.sub(r"-+", "-", s).strip("-")


def load_bank():
    all_q = []
    seen_uids = set()
    problems = []
    if not os.path.isdir(BANK_DIR):
        return all_q, problems
    for fname in sorted(os.listdir(BANK_DIR)):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(BANK_DIR, fname)
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        subject_default = data.get("subject")
        for q in data.get("questions", []):
            diff = q.get("difficulty")
            if diff not in DIFFICULTIES:
                problems.append(f"{fname}: question id={q.get('id')} has invalid/missing difficulty '{diff}' — skipped")
                continue
            if not q.get("subject"):
                q["subject"] = subject_default
            uid = f"{fname}::{q.get('id')}"
            if uid in seen_uids:
                problems.append(f"{fname}: duplicate id {q.get('id')} — skipped")
                continue
            seen_uids.add(uid)
            q["_bankFile"] = fname
            q["_uid"] = uid
            all_q.append(q)
    return all_q, problems


def validate_question(q, problems, where):
    ok = True
    opts = q.get("options")
    if not isinstance(opts, dict) or set(opts.keys()) != {"A", "B", "C", "D"}:
        problems.append(f"{where}: question {q.get('_uid')} does not have exactly options A-D — skipped")
        ok = False
    if q.get("correctAnswer") not in ("A", "B", "C", "D"):
        problems.append(f"{where}: question {q.get('_uid')} has invalid correctAnswer — skipped")
        ok = False
    if not q.get("question") or not q.get("explanation"):
        problems.append(f"{where}: question {q.get('_uid')} missing question/explanation text — skipped")
        ok = False
    return ok


def chunk_disjoint_first(questions, size):
    """Yield as many fully-disjoint chunks of `size` as possible from `questions`
    (already shuffled). Returns (chunks, leftover)."""
    chunks = []
    i = 0
    while i + size <= len(questions):
        chunks.append(questions[i:i + size])
        i += size
    leftover = questions[i:]
    return chunks, leftover


def main():
    random.seed(SEED)
    all_q, problems = load_bank()
    print(f"Loaded {len(all_q)} questions from bank ({len(problems)} problems).")

    by_diff = {d: [] for d in DIFFICULTIES}
    for q in all_q:
        if not validate_question(q, problems, "compose"):
            continue
        by_diff[q["difficulty"]].append(q)

    os.makedirs(OUT_DIR, exist_ok=True)
    # Clear previously generated papers so removed/edited bank questions don't leave stale files behind
    for fname in os.listdir(OUT_DIR):
        if fname.endswith(".json"):
            os.remove(os.path.join(OUT_DIR, fname))

    manifest_entries = []
    summary = {}

    for diff in DIFFICULTIES:
        pool = list(by_diff[diff])
        random.shuffle(pool)
        chunks, leftover = chunk_disjoint_first(pool, PAPER_SIZE)

        # If there's a partial leftover, top it up by borrowing a few extra
        # questions from earlier chunks (controlled reuse, capped well under 5%
        # of a 20-question paper i.e. at most 1 reused question) rather than
        # discarding a good chunk of banked content.
        if 0 < len(leftover) < PAPER_SIZE and chunks:
            needed = PAPER_SIZE - len(leftover)
            donors = []
            for c in chunks:
                donors.extend(random.sample(c, min(1, len(c))))  # at most 1 borrowed per donor chunk
                if len(donors) >= needed:
                    break
            leftover = leftover + donors[:needed]
            if len(leftover) == PAPER_SIZE:
                chunks.append(leftover)

        summary[diff] = {"pool_size": len(pool), "papers": len(chunks)}

        for idx, chunk in enumerate(chunks, start=1):
            paper_id = f"{diff.lower()}-practice-set-{idx}"
            subjects_in_set = sorted(set(q["subject"] for q in chunk))
            paper = {
                "paperId": paper_id,
                "paperName": f"{diff} Practice Set {idx}",
                "subject": "Mixed" if len(subjects_in_set) > 1 else subjects_in_set[0],
                "description": f"{diff}-difficulty practice set ({len(chunk)} questions) covering: {', '.join(subjects_in_set)}.",
                "durationMinutes": 90,
                "scoring": {"correct": 1, "incorrect": 0, "unanswered": 0, "negativeMarkingEnabled": False},
                "questions": []
            }
            for i, q in enumerate(chunk, start=1):
                clean_q = {k: v for k, v in q.items() if not k.startswith("_")}
                clean_q["id"] = i
                paper["questions"].append(clean_q)
            out_path = os.path.join(OUT_DIR, paper_id + ".json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(paper, f, indent=2, ensure_ascii=False)
            manifest_entries.append({
                "id": paper_id,
                "file": "generated/" + paper_id + ".json",
                "name": paper["paperName"],
                "subject": paper["subject"],
                "description": paper["description"],
                "difficulty": diff,
                "questionCount": len(chunk)
            })

    # Merge into manifest.json: keep all hand-authored entries (validation-batch-1, sample-mixed-1,
    # the real mixed mock exam if present), replace any previously-generated practice-set entries.
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)
    kept = [p for p in manifest["papers"] if not re.match(r"^(easy|medium|hard)-practice-set-\d+$", p["id"])]
    manifest["papers"] = kept + manifest_entries
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print("\n=== Summary ===")
    for diff in DIFFICULTIES:
        s = summary.get(diff, {"pool_size": 0, "papers": 0})
        print(f"{diff}: {s['pool_size']} bank questions -> {s['papers']} papers of {PAPER_SIZE}")
    print(f"\nTotal papers generated: {len(manifest_entries)}")
    if problems:
        print(f"\n{len(problems)} problems (skipped items):")
        for p in problems[:50]:
            print(" -", p)


if __name__ == "__main__":
    main()
