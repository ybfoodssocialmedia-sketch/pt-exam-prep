"""
Adds a batch of new questions to a bank file.

A batch is a small Python file defining:
  FILE     bank file name, e.g. "electrotherapy.json"
  SUBJECT  exact subject name (must match the weightage list in compose_papers.py)
  IDP      id prefix, e.g. "electro"
  BOOK     default sourceBook string
  Q        list of tuples:
           (topic, subtopic, difficulty, question, correct, wrong1, wrong2, wrong3, explanation
            [, sourceBook [, sourceChapter [, sourcePage]]])

The CORRECT option is always written first in the batch; this script shuffles option
positions (deterministically per question) so the answer letter is not biased.
Options that depend on position ("All of the above", "Both A and B") must not be used.

Usage: python add_batch.py <batch.py>
"""
import hashlib
import importlib.util
import json
import os
import random
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK_DIR = os.path.join(ROOT, "papers", "bank")
BANNED = re.compile(r"\b(all of the above|none of the above|both a and b|a and b)\b", re.I)


def norm(t):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9. ]", "", t.lower())).strip()


def main(path):
    spec = importlib.util.spec_from_file_location("batch", path)
    b = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(b)

    bank_path = os.path.join(BANK_DIR, b.FILE)
    if os.path.exists(bank_path):
        with open(bank_path, encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"subject": b.SUBJECT, "questions": []}
    assert data.get("subject", b.SUBJECT) == b.SUBJECT, "subject mismatch"
    data["subject"] = b.SUBJECT

    existing_text = set()
    max_n = 0
    for fname in os.listdir(BANK_DIR):
        if fname.endswith(".json") and fname != "index.json":
            with open(os.path.join(BANK_DIR, fname), encoding="utf-8") as f:
                for q in json.load(f).get("questions", []):
                    existing_text.add(norm(q["question"]))
    for q in data["questions"]:
        m = re.search(r"-(\d+)$", str(q["id"]))
        if m:
            max_n = max(max_n, int(m.group(1)))

    added, skipped = 0, []
    for row in b.Q:
        if len(row) < 9:
            skipped.append(("bad tuple length", str(row)[:60])); continue
        topic, sub, diff, question, correct, w1, w2, w3, expl = row[:9]
        book = row[9] if len(row) > 9 else b.BOOK
        chapter = row[10] if len(row) > 10 else topic
        page = row[11] if len(row) > 11 else None
        opts = [correct, w1, w2, w3]
        if diff not in ("Easy", "Medium", "Hard"):
            skipped.append(("bad difficulty", question[:60])); continue
        if len({norm(o) for o in opts}) < 4 or any(not o.strip() for o in opts):
            skipped.append(("duplicate/empty options", question[:60])); continue
        if any(BANNED.search(o) for o in opts):
            skipped.append(("position-dependent option", question[:60])); continue
        if norm(question) in existing_text:
            skipped.append(("duplicate question", question[:60])); continue
        order = list(range(4))
        random.Random(hashlib.sha1(question.encode("utf-8")).hexdigest()).shuffle(order)
        letters = "ABCD"
        options = {letters[i]: opts[order[i]] for i in range(4)}
        ans = letters[order.index(0)]
        max_n += 1
        existing_text.add(norm(question))
        data["questions"].append({
            "id": f"{b.IDP}-{max_n}", "topic": topic, "subtopic": sub, "difficulty": diff,
            "question": question, "options": options, "correctAnswer": ans, "explanation": expl,
            "sourceBook": book, "sourceChapter": chapter, "sourcePage": page,
        })
        added += 1

    with open(bank_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"{b.FILE}: +{added} added, {len(skipped)} skipped, total now {len(data['questions'])}")
    for s in skipped:
        print("  skipped:", s)


if __name__ == "__main__":
    main(sys.argv[1])
