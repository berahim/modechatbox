"""Checks for approved frontend intent matching data."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

INTENTS_PATH = Path(__file__).resolve().parent.parent / "chatbox-intents.nl.json"
EDGE_PUNCTUATION_RE = re.compile(r"^[?!.," "'" r"()]+|[?!.," "'" r"()]+$")

GREETING_ANSWER = (
    "Goedendag! Waarmee kan ik u helpen? U kunt hier vragen stellen over onze "
    "producten, leveringen, bestellingen of contact opnemen."
)


def _load_intents() -> dict:
    return json.loads(INTENTS_PATH.read_text(encoding="utf-8"))


def _normalize_text(text: str) -> str:
    collapsed = " ".join(text.lower().strip().split())
    return EDGE_PUNCTUATION_RE.sub("", collapsed).strip()


def _match_intent(data: dict, user_text: str) -> dict | None:
    normalized_input = _normalize_text(user_text)
    if not normalized_input:
        return None

    matches = []
    for intent in data.get("intents", []):
        if intent.get("status") != "approved":
            continue
        candidates = [intent["question"], *intent.get("exampleUserQuestions", [])]
        if any(_normalize_text(candidate) == normalized_input for candidate in candidates):
            matches.append(intent)

    return matches[0] if len(matches) == 1 else None


@pytest.mark.parametrize("message", ["Hallo", "goedendag!", "Hi"])
def test_greetings_return_safe_greeting(message):
    matched = _match_intent(_load_intents(), message)

    assert matched is not None
    assert matched["id"] == "greeting"
    assert matched["answer"] == GREETING_ANSWER


def test_unrelated_question_remains_out_of_scope():
    matched = _match_intent(_load_intents(), "Kunnen jullie mijn webshop bouwen?")

    assert matched is None
