"""
Composes the flagship 100-question Mock Exam, matching the REAL PGP-CET 2025
topic weightage (from the official exam brochure). Pulls the exact number of
questions needed per topic from the bank, selecting the best-fit subset
without reuse across topics.

Run with the Python 3.12 interpreter (stdlib only):
  C:\\Users\\Lenovo\\AppData\\Local\\Programs\\Python\\Python312\\python.exe tools\\compose_mock_exam.py
"""
import json
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK_DIR = os.path.join(ROOT, "papers", "bank")
OUT_PATH = os.path.join(ROOT, "papers", "generated", "mock-exam-1.json")
MANIFEST_PATH = os.path.join(ROOT, "papers", "manifest.json")
SEED = 7

# Real PGP-CET 2025 weightage (subject -> marks/questions needed), per the
# official exam brochure. "Fundamentals of Electro Therapy" and "Electrical
# Agents" are combined here (5+7=12) since the bank pools them under one
# subject; everything else maps 1:1 to a bank subject name.
WEIGHTAGE = [
    ("Anatomy", 4),
    ("Physiology", 4),
    ("Biochemistry", 2),
    ("Fundamentals of Exercise Therapy", 5),
    ("Fundamentals of Electro Therapy", 12),  # combines Fund. Electro Therapy (5) + Electrical Agents (7)
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

assert sum(n for _, n in WEIGHTAGE) == 100, "Weightage must sum to 100"


def load_bank_by_subject():
    by_subject = {}
    for fname in sorted(os.listdir(BANK_DIR)):
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(BANK_DIR, fname), encoding="utf-8") as f:
            data = json.load(f)
        for q in data.get("questions", []):
            subj = q.get("subject") or data.get("subject")
            by_subject.setdefault(subj, []).append(q)
    return by_subject


def main():
    random.seed(SEED)
    by_subject = load_bank_by_subject()

    selected = []
    shortfalls = []
    for subject, needed in WEIGHTAGE:
        pool = list(by_subject.get(subject, []))
        random.shuffle(pool)
        if len(pool) < needed:
            shortfalls.append((subject, needed, len(pool)))
            chosen = pool  # take everything available, flag the shortfall
        else:
            chosen = pool[:needed]
        selected.extend(chosen)

    if shortfalls:
        print("WARNING: shortfalls (real weightage not fully met with current bank):")
        for subject, needed, have in shortfalls:
            print(f"  - {subject}: needed {needed}, only {have} available")
        print("Aborting — add more bank questions for these subjects before composing the real Mock Exam.")
        return

    paper = {
        "paperId": "mock-exam-1",
        "paperName": "PGP-CET Mixed Mock Exam 1",
        "subject": "Mixed (Real Weightage)",
        "description": "Full 100-question mock exam following the REAL PGP-CET 2025 topic weightage (per the official exam brochure), sourced entirely from uploaded reference books with citations.",
        "durationMinutes": 90,
        "scoring": {"correct": 1, "incorrect": 0, "unanswered": 0, "negativeMarkingEnabled": False},
        "questions": []
    }
    for i, q in enumerate(selected, start=1):
        clean_q = {k: v for k, v in q.items() if not k.startswith("_")}
        clean_q["id"] = i
        paper["questions"].append(clean_q)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(paper, f, indent=2, ensure_ascii=False)

    # Register in manifest.json (idempotent: replace if already present)
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)
    manifest["papers"] = [p for p in manifest["papers"] if p["id"] != "mock-exam-1"]
    manifest["papers"].append({
        "id": "mock-exam-1",
        "file": "generated/mock-exam-1.json",
        "name": "PGP-CET Mixed Mock Exam 1",
        "subject": "Mixed (Real Weightage)",
        "description": paper["description"],
        "difficulty": "Mixed",
        "questionCount": len(paper["questions"])
    })
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"Composed mock-exam-1.json with {len(paper['questions'])} questions, matching real PGP-CET weightage.")
    for subject, needed in WEIGHTAGE:
        print(f"  {subject}: {needed}")


if __name__ == "__main__":
    main()
