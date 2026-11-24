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


# SCORE Curriculum Outline category for each topic (names as in the ABS ABSITE content outline).
SCORE = {
    "Trauma": "Trauma",
    "Critical Care": "Surgical Critical Care",
    "Fluids & Electrolytes": "Fluids, Electrolytes and Acid-Base Balance",
    "Hematology": "Transfusion and Disorders of Coagulation",
    "Infection": "Infection and Antimicrobial Therapy",
    "Nutrition": "Nutrition and Metabolism",
    "Anesthesia & Pharmacology": "Anesthesia",
    "Wound Healing": "Wound Healing",
    "Breast": "Breast",
    "Endocrine": "Endocrine",
    "Esophagus": "Alimentary Tract - Esophagus",
    "Stomach": "Alimentary Tract - Stomach",
    "Small Bowel": "Alimentary Tract - Small Intestine",
    "Colorectal": "Alimentary Tract - Large Intestine",
    "Hepatobiliary": "Abdomen - Liver",
    "Pancreas": "Abdomen - Pancreas",
    "Spleen": "Abdomen - Spleen",
    "Hernia": "Abdomen - Hernia",
    "Vascular": "Vascular - Arterial Disease",
    "Thoracic": "Thoracic Surgery",
    "Transplant": "Transplantation",
    "Pediatric Surgery": "Pediatric Surgery",
    "Burns": "Trauma",
    "Skin & Soft Tissue": "Skin and Soft Tissue",
    "Statistics & Ethics": "Biostatistics and Evaluation of Evidence",
    "Head & Neck": "Head and Neck",
    "Oncology": "Oncology and Tumor Biology",
}
# Items whose category differs from their topic's default, by id.
SCORE_BY_ID = {
    "hepatobiliary-008": "Abdomen - Biliary",
    "hepatobiliary-009": "Abdomen - Biliary",
    "hepatobiliary-011": "Abdomen - Biliary",
    "q029": "Abdomen - Biliary",
    "q030": "Abdomen - Biliary",
    "vascular-008": "Vascular - Venous",
    "vascular-010": "Vascular - Venous",
    "colorectal-008": "Alimentary Tract - Anorectal",
    "colorectal-009": "Alimentary Tract - Anorectal",
    "q027": "Alimentary Tract - Anorectal",
    "anesthesia-pharmacology-007": "Pharmacology",
    "statistics-ethics-006": "Ethics",
    "critical-care-008": "Preoperative Evaluation and Perioperative Care",
    "burns-006": "Skin and Soft Tissue",
}


def score(item_id, topic):
    return SCORE_BY_ID.get(item_id, SCORE[topic])


def slug(topic):
    return re.sub(r"[^a-z]+", "-", topic.lower()).strip("-")


def points(extra):
    """Split an explanation into short, scannable lines (keeps 'S. aureus' style abbreviations intact)."""
    return [p.strip() for p in re.split(r"(?<=\S\S)\.\s+(?=[A-Z0-9])", extra.strip()) if p.strip()]


def with_points(card):
    parts = points(card["extra"])
    parts = [p if p.endswith(".") else p + "." for p in parts]
    return dict(card, points=parts)


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
            "score": score(f"q{i:03d}", q["topic"]),
            "stem": q["stem"],
            "choices": [q["choices"][j] for j in order],
            "answer": order.index(q["answer"]),
            "explanation": q["explanation"],
            "card": with_points(q["card"]),
        })
    return out


def build_cards():
    out = []
    for topic, cards in CARDS.items():
        for i, (text, extra) in enumerate(cards, start=1):
            assert CLOZE.search(text), text
            card_id = f"{slug(topic)}-{i:03d}"
            out.append(with_points({"id": card_id, "topic": topic, "score": score(card_id, topic),
                                    "text": text, "extra": extra}))
    return out


def main():
    questions, cards = build_questions(), build_cards()
    ids = [x["id"] for x in questions + cards]
    assert len(ids) == len(set(ids)), "duplicate ids"
    assert set(CARDS) <= set(SCORE), f"topics without a SCORE category: {set(CARDS) - set(SCORE)}"
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
