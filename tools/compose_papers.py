"""
Composer: turns the question bank (papers/bank/*.json) into
  1. papers/bank/index.json  — small summary used by the "Practice by Subject" picker
  2. 100-question papers in papers/generated/ that follow the REAL PGP-CET 2025
     topic weightage (e.g. 10 PT-Neuro, 12 Electro, 8 Physical Diagnosis ...)

Rules
  * A paper is only built if EVERY subject's weightage can be met in full.
  * Papers are frozen once published (so a "Solved" tick and history never point at a
    paper whose questions silently changed). New papers are only added on top.
  * Questions are never reused while enough unused ones exist. When a subject runs
    short, up to MAX_REUSE (5 = 5%) questions may be borrowed from earlier papers,
    so any two papers share at most 5 questions.
  * Each paper is labelled Easy / Medium / Hard from the ACTUAL difficulty mix of its
    questions, never from what we hoped for.

Run (stdlib only):
  C:\\Users\\Lenovo\\AppData\\Local\\Programs\\Python\\Python312\\python.exe tools\\compose_papers.py
"""
import hashlib
import json
import os
import random
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK_DIR = os.path.join(ROOT, "papers", "bank")
OUT_DIR = os.path.join(ROOT, "papers", "generated")
MANIFEST_PATH = os.path.join(ROOT, "papers", "manifest.json")
INDEX_PATH = os.path.join(BANK_DIR, "index.json")
PAPER_SIZE = 100
MAX_REUSE = 5
MAX_PAPERS = 60
DIFFICULTIES = ["Easy", "Medium", "Hard"]

# Real PGP-CET 2025 weightage. "Fundamentals of Electro Therapy" (5) and "Electrical
# Agents" (7) are pooled under one bank subject, hence 12.
WEIGHTAGE = [
    ("Anatomy", 4),
    ("Physiology", 4),
    ("Biochemistry", 2),
    ("Fundamentals of Exercise Therapy", 5),
    ("Fundamentals of Electro Therapy", 12),
    ("Pharmacology", 2),
    ("Pathology & Microbiology", 4),
    ("Psychology", 1),
    ("Psychiatry", 1),
    ("Kinesio Therapeutics", 7),
    ("General Surgery & Orthopedics", 6),
    ("Medicine", 6),
    ("OBGY", 3),
    ("Physical Diagnosis & Manipulative Skills", 8),
    ("Physiotherapy in Musculoskeletal Condition", 10),
    ("Physiotherapy in Neurosciences", 10),
    ("Physiotherapy in General Medical & Surgical Condition", 10),
    ("Physiotherapy in Community Health", 5),
]
assert sum(n for _, n in WEIGHTAGE) == PAPER_SIZE

# Order in which difficulties are preferred when filling a paper aimed at each tier
TIER_PREFERENCE = {
    "Easy": ["Easy", "Medium", "Hard"],
    "Medium": ["Medium", "Easy", "Hard"],
    "Hard": ["Hard", "Medium", "Easy"],
}
TIER_ROTATION = ["Easy", "Medium", "Hard"]


def stable_key(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()


def norm_text(t):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", t.lower())).strip()


def load_bank():
    questions, problems, seen_text = [], [], {}
    files = sorted(f for f in os.listdir(BANK_DIR) if f.endswith(".json") and f != "index.json")
    for fname in files:
        with open(os.path.join(BANK_DIR, fname), encoding="utf-8") as f:
            data = json.load(f)
        default_subject = data.get("subject")
        for q in data.get("questions", []):
            uid = f"{fname}::{q.get('id')}"
            q["subject"] = q.get("subject") or default_subject
            where = uid
            opts = q.get("options")
            if q.get("difficulty") not in DIFFICULTIES:
                problems.append(f"{where}: bad difficulty"); continue
            if not isinstance(opts, dict) or set(opts) != {"A", "B", "C", "D"}:
                problems.append(f"{where}: options must be exactly A-D"); continue
            if q.get("correctAnswer") not in opts:
                problems.append(f"{where}: bad correctAnswer"); continue
            if len({norm_text(v) for v in opts.values()}) < 4:
                problems.append(f"{where}: duplicate option text"); continue
            if not q.get("question") or not q.get("explanation") or not q.get("sourceBook"):
                problems.append(f"{where}: missing question/explanation/sourceBook"); continue
            nt = norm_text(q["question"])
            if nt in seen_text:
                problems.append(f"{where}: duplicate of {seen_text[nt]} — skipped"); continue
            seen_text[nt] = uid
            q["_uid"] = uid
            q["_file"] = fname
            questions.append(q)
    return questions, problems


def write_index(questions):
    by_subject = {}
    for q in questions:
        s = by_subject.setdefault(q["subject"], {"subject": q["subject"], "files": set(), "count": 0, "topics": {}})
        s["files"].add(q["_file"])
        s["count"] += 1
        t = q.get("topic") or "General"
        s["topics"][t] = s["topics"].get(t, 0) + 1
    out = []
    for s in sorted(by_subject.values(), key=lambda x: x["subject"]):
        out.append({
            "subject": s["subject"],
            "files": sorted(s["files"]),
            "count": s["count"],
            "topics": [{"topic": t, "count": c} for t, c in sorted(s["topics"].items(), key=lambda x: -x[1])],
        })
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump({"subjects": out}, f, indent=1, ensure_ascii=False)


def label_tier(qs):
    score = sum({"Easy": 1, "Medium": 2, "Hard": 3}[q["difficulty"]] for q in qs) / len(qs)
    return "Easy" if score < 1.75 else ("Medium" if score < 2.35 else "Hard")


def load_existing_papers():
    papers = []
    for fname in sorted(os.listdir(OUT_DIR)):
        if re.match(r"^(easy|medium|hard)-paper-\d+\.json$", fname):
            with open(os.path.join(OUT_DIR, fname), encoding="utf-8") as f:
                papers.append(json.load(f))
    return papers


def try_build_paper(target_tier, bank_by_subject, used_count, rng):
    """Returns list of chosen questions, or None if weightage can't be met."""
    pref = TIER_PREFERENCE[target_tier]
    chosen, shortfall_total = [], 0
    picks_by_subject = {}
    for subject, quota in WEIGHTAGE:
        pool = bank_by_subject.get(subject, [])
        fresh = [q for q in pool if used_count.get(q["_uid"], 0) == 0]
        fresh.sort(key=lambda q: (pref.index(q["difficulty"]), stable_key(q["_uid"])))
        take = fresh[:quota]
        picks_by_subject[subject] = take
        shortfall_total += quota - len(take)
    if shortfall_total > MAX_REUSE:
        return None
    for subject, quota in WEIGHTAGE:
        take = picks_by_subject[subject]
        need = quota - len(take)
        if need:
            taken = {q["_uid"] for q in take}
            reuse = [q for q in bank_by_subject.get(subject, []) if q["_uid"] not in taken]
            if len(reuse) < need:
                return None
            reuse.sort(key=lambda q: (used_count.get(q["_uid"], 0), pref.index(q["difficulty"]), stable_key(q["_uid"])))
            take = take + reuse[:need]
        chosen.extend(take)
    rng.shuffle(chosen)
    return chosen


def main():
    questions, problems = load_bank()
    os.makedirs(OUT_DIR, exist_ok=True)
    write_index(questions)

    # Remove legacy 20-question sets and the old standalone mock exam (superseded)
    for fname in os.listdir(OUT_DIR):
        if re.match(r"^(easy|medium|hard)-practice-set-\d+\.json$", fname) or fname == "mock-exam-1.json":
            os.remove(os.path.join(OUT_DIR, fname))

    bank_by_subject = {}
    for q in questions:
        bank_by_subject.setdefault(q["subject"], []).append(q)
    valid_uids = {q["_uid"] for q in questions}

    existing = load_existing_papers()
    used_count = {}
    for p in existing:
        for q in p["questions"]:
            ref = q.get("bankRef")
            if ref:
                used_count[ref] = used_count.get(ref, 0) + 1
    tier_counts = {t: 0 for t in DIFFICULTIES}
    for p in existing:
        tier_counts[p["difficulty"]] += 1

    new_papers = []
    rotation_idx = len(existing)
    while len(existing) + len(new_papers) < MAX_PAPERS:
        target = TIER_ROTATION[rotation_idx % 3]
        rng = random.Random(1000 + rotation_idx)
        chosen = try_build_paper(target, bank_by_subject, used_count, rng)
        if chosen is None:
            break
        rotation_idx += 1
        tier = label_tier(chosen)
        tier_counts[tier] += 1
        n = tier_counts[tier]
        pid = f"{tier.lower()}-paper-{n}"
        subjects = [s for s, _ in WEIGHTAGE]
        mix = {d: sum(1 for q in chosen if q["difficulty"] == d) for d in DIFFICULTIES}
        paper = {
            "paperId": pid,
            "paperName": f"{tier} Paper {n}",
            "subject": "Mixed (Real Weightage)",
            "difficulty": tier,
            "description": f"100 questions following the real PGP-CET 2025 subject weightage. Mix: {mix['Easy']} easy / {mix['Medium']} medium / {mix['Hard']} hard. Every question cites its source.",
            "durationMinutes": 90,
            "scoring": {"correct": 1, "incorrect": 0, "unanswered": 0, "negativeMarkingEnabled": False},
            "questions": [],
        }
        for i, q in enumerate(chosen, start=1):
            cq = {k: v for k, v in q.items() if not k.startswith("_")}
            cq["id"] = i
            cq["bankRef"] = q["_uid"]
            paper["questions"].append(cq)
            used_count[q["_uid"]] = used_count.get(q["_uid"], 0) + 1
        with open(os.path.join(OUT_DIR, pid + ".json"), "w", encoding="utf-8") as f:
            json.dump(paper, f, indent=1, ensure_ascii=False)
        new_papers.append(paper)

    # Manifest: keep hand-authored fixtures, replace generated entries
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)
    kept = [p for p in manifest["papers"] if p.get("isSample")]
    entries = []
    for p in existing + new_papers:
        entries.append({
            "id": p["paperId"], "file": f"generated/{p['paperId']}.json", "name": p["paperName"],
            "subject": p["subject"], "description": p["description"], "difficulty": p["difficulty"],
            "questionCount": len(p["questions"]),
        })
    order = {"Easy": 0, "Medium": 1, "Hard": 2}
    entries.sort(key=lambda e: (order[e["difficulty"]], int(re.search(r"(\d+)$", e["id"]).group(1))))
    manifest["papers"] = kept + entries
    for p in manifest["papers"]:
        if p.get("isSample"):
            p["includeInSubjectPool"] = False
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"Bank: {len(questions)} valid questions, {len(problems)} problems")
    for p in problems[:40]:
        print("  -", p)
    print(f"Papers: {len(existing)} kept + {len(new_papers)} new = {len(entries)}  ({', '.join(f'{t}:{tier_counts[t]}' for t in DIFFICULTIES)})")
    # Shortfall report: how many more fresh questions would the NEXT paper need?
    print("Fresh (never-used) questions left vs one paper's need:")
    for subject, quota in WEIGHTAGE:
        fresh = sum(1 for q in bank_by_subject.get(subject, []) if used_count.get(q["_uid"], 0) == 0)
        flag = "" if fresh >= quota else f"   <-- short by {quota - fresh}"
        print(f"  {subject:56} fresh {fresh:3}  need {quota:2}{flag}")


if __name__ == "__main__":
    main()
