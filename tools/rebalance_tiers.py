"""
Splits the generated papers into three equal tiers by their RELATIVE difficulty.

Each paper's difficulty score is the mean of its questions' difficulty tags (Easy=1, Medium=2,
Hard=3). Papers are ranked by that score; the easiest third is labelled Easy, the hardest third
Hard and the middle third Medium. Difficulty tags are the author's judgement, so tiers are
relative ("easier than the rest of the set"), not absolute.

Papers whose tier does not change keep their id. A paper that moves tier gets a new id
(<tier>-paper-N) and the old id is recorded in manifest.json "aliases" so a device that already
stored history / progress under the old id is migrated automatically by js/core.js.

Usage: python tools/rebalance_tiers.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, "papers", "generated")
MANIFEST = os.path.join(ROOT, "papers", "manifest.json")
SCORE = {"Easy": 1, "Medium": 2, "Hard": 3}


def load():
    papers = []
    for fname in sorted(os.listdir(GEN)):
        if re.match(r"^(easy|medium|hard)-paper-\d+\.json$", fname):
            with open(os.path.join(GEN, fname), encoding="utf-8") as f:
                papers.append(json.load(f))
    return papers


def main():
    papers = load()
    n = len(papers)
    third = n // 3
    # rank: mean difficulty, then number of Hard questions, then id (stable)
    def key(p):
        qs = p["questions"]
        mean = sum(SCORE[q["difficulty"]] for q in qs) / len(qs)
        hard = sum(1 for q in qs if q["difficulty"] == "Hard")
        return (round(mean, 4), hard, p["paperId"])

    ranked = sorted(papers, key=key)
    tier_of = {}
    for i, p in enumerate(ranked):
        tier_of[p["paperId"]] = "Easy" if i < third else ("Medium" if i < n - third else "Hard")

    # keep ids of papers that stay in their tier; number the movers after the current maximum
    next_no = {"Easy": 0, "Medium": 0, "Hard": 0}
    for p in papers:
        t = p["difficulty"]
        next_no[t] = max(next_no[t], int(re.search(r"(\d+)$", p["paperId"]).group(1)))
    aliases = {}
    for p in sorted(papers, key=lambda x: x["paperId"]):
        old_id = p["paperId"]
        new_tier = tier_of[old_id]
        mix = {d: sum(1 for q in p["questions"] if q["difficulty"] == d) for d in SCORE}
        if new_tier != p["difficulty"]:
            next_no[new_tier] += 1
            new_id = f"{new_tier.lower()}-paper-{next_no[new_tier]}"
            aliases[old_id] = new_id
            os.remove(os.path.join(GEN, old_id + ".json"))
            p["paperId"] = new_id
            p["paperName"] = f"{new_tier} Paper {next_no[new_tier]}"
            p["difficulty"] = new_tier
        p["description"] = (
            f"100 questions following the real PGP-CET 2025 subject weightage. Mix: {mix['Easy']} easy / "
            f"{mix['Medium']} medium / {mix['Hard']} hard. Tier is relative: the {new_tier.lower()} third "
            f"of the {n} papers by average question difficulty. Every question cites its source."
        )
        with open(os.path.join(GEN, p["paperId"] + ".json"), "w", encoding="utf-8") as f:
            json.dump(p, f, indent=1, ensure_ascii=False)

    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)
    kept = [e for e in manifest["papers"] if e.get("isSample")]
    entries = []
    for p in load():
        entries.append({
            "id": p["paperId"], "file": f"generated/{p['paperId']}.json", "name": p["paperName"],
            "subject": p["subject"], "description": p["description"], "difficulty": p["difficulty"],
            "questionCount": len(p["questions"]),
        })
    order = {"Easy": 0, "Medium": 1, "Hard": 2}
    entries.sort(key=lambda e: (order[e["difficulty"]], int(re.search(r"(\d+)$", e["id"]).group(1))))
    manifest["papers"] = kept + entries
    old_aliases = manifest.get("aliases", {})
    old_aliases.update(aliases)
    # chain: an alias that points to an id that has itself been renamed must follow the chain
    for k, v in list(old_aliases.items()):
        while v in old_aliases and old_aliases[v] != v:
            v = old_aliases[v]
        old_aliases[k] = v
    manifest["aliases"] = old_aliases
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    counts = {t: sum(1 for e in entries if e["difficulty"] == t) for t in order}
    print("Tiers:", counts, "| renamed papers:", len(aliases))


if __name__ == "__main__":
    main()
