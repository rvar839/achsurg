#!/usr/bin/env python3
"""Builds the app's content JSON from tools/questions.py and tools/cards.py.

Usage: python3 tools/build_content.py
"""
import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cards import CARDS  # noqa: E402
from questions import QUESTIONS  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "Absite" / "Resources" / "Content"
CLOZE = re.compile(r"\{\{.+?\}\}")


def slug(topic):
    return re.sub(r"[^a-z]+", "-", topic.lower()).strip("-")


def build_questions():
    out = []
    for i, q in enumerate(QUESTIONS, start=1):
        assert 0 <= q["answer"] < len(q["choices"]), q["stem"]
        assert CLOZE.search(q["card"]["text"]), q["stem"]
        # Shuffle choices deterministically so the correct answer's position varies.
        order = list(range(len(q["choices"])))
        random.Random(i * 7919).shuffle(order)
        out.append({
            "id": f"q{i:03d}",
            "topic": q["topic"],
            "stem": q["stem"],
            "choices": [q["choices"][j] for j in order],
            "answer": order.index(q["answer"]),
            "explanation": q["explanation"],
            "card": q["card"],
        })
    return out


def build_cards():
    out = []
    for topic, cards in CARDS.items():
        for i, (text, extra) in enumerate(cards, start=1):
            assert CLOZE.search(text), text
            out.append({"id": f"{slug(topic)}-{i:03d}", "topic": topic, "text": text, "extra": extra})
    return out


def main():
    questions, cards = build_questions(), build_cards()
    ids = [x["id"] for x in questions + cards]
    assert len(ids) == len(set(ids)), "duplicate ids"
    unknown = {q["topic"] for q in questions} - set(CARDS)
    assert not unknown, f"question topics without cards: {unknown}"
    OUT.mkdir(parents=True, exist_ok=True)
    # Same content ships in the iPhone app and the web app.
    for folder in (OUT, OUT.parents[2] / "web" / "content"):
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "questions.json").write_text(json.dumps(questions, indent=1, ensure_ascii=False) + "\n")
        (folder / "cards.json").write_text(json.dumps(cards, indent=1, ensure_ascii=False) + "\n")
    positions = [q["answer"] for q in questions]
    print(f"{len(questions)} questions, {len(cards)} cards, {len(CARDS)} topics")
    print("answer positions:", {p: positions.count(p) for p in sorted(set(positions))})


if __name__ == "__main__":
    main()
