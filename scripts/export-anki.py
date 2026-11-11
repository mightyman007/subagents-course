#!/usr/bin/env python3
"""Export the Subagents Mastery flashcards as a real Anki deck (.apkg).

Deck structure (per the task spec):
- One Anki deck per chapter: "Subagents Mastery::<NN> <chapter title>", with
  <NN> the zero-padded frontmatter `order` and <title> from index.mdx.
- A parent deck "Subagents Mastery" for the hierarchy.
- The final exam is NOT part of the deck: exam questions are quiz questions,
  not flashcards. The deck is built from the chapter flashcards ONLY.

Note identity:
- Note guid is derived from the flashcard `id` (stable across exports), so
  re-importing an updated deck updates existing cards instead of duplicating
  them. Deck and model ids are fixed constants/derivations for the same reason.

Data hygiene (checked for every run, both modes):
- No empty front/back fields; duplicate card ids across the whole deck are a
  hard error (they would collide on guid).

Modes:
- `--dry-run`: print the deck data as JSON on stdout (and exit 1 if the data
  is dirty — empty fields or duplicate ids), write nothing.
- `--inspect <path.apkg>`: READ-ONLY re-derivation of deck data from a
  committed package — opens the zip, loads collection.anki2 into an
  in-memory sqlite (no file writes, the package is never modified), and
  prints the same JSON note shape as --dry-run ({parentDeck, totalNotes,
  decks, notes: [{guid, front, back, deck}, ...]}). Fields are split from
  notes.flds on the Anki field separator \x1f in model order Front/Back/Tags;
  the note→deck mapping comes from cards.did via the col.decks JSON.
- default: package `public/downloads/subagents-course.apkg`, print a summary.

Toolchain: Python 3 + genanki (+ pyyaml) in a project-local venv:
    python3 -m venv scripts/.venv
    scripts/.venv/bin/pip install genanki pyyaml
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import zlib
import zipfile
from pathlib import Path

import genanki
import yaml

ROOT = Path(__file__).resolve().parents[1]
CHAPTERS_DIR = ROOT / "content" / "chapters"
DEFAULT_OUT = ROOT / "public" / "downloads" / "subagents-course.apkg"

DECK_ROOT = "Subagents Mastery"

# Fixed ids: stable across runs so re-imports update rather than duplicate.
MODEL_ID = 1741920001
MODEL_NAME = "Subagents Basic (Front/Back/Tags)"

CSS = """
.card {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 18px;
  line-height: 1.5;
  color: #e4e4e7;
  background-color: #0a0a0b;
  text-align: left;
  padding: 1rem;
}
hr#answer { border: 0; border-top: 1px solid #27272a; margin: 1rem 0; }
.tags { font-family: ui-monospace, monospace; font-size: 12px; color: #a1a1aa; }
""".strip()


def fail(message: str) -> "NoReturn":  # type: ignore[valid-type]
    print(f"export-anki: {message}", file=sys.stderr)
    sys.exit(1)


def chapter_frontmatter(index_mdx: Path) -> dict:
    """Parse the leading YAML frontmatter block of a chapter's index.mdx."""
    text = index_mdx.read_text(encoding="utf-8")
    match = re.match(r"\A---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not match:
        fail(f"{index_mdx}: missing frontmatter block (--- ... ---)")
    meta = yaml.safe_load(match.group(1))
    if not isinstance(meta, dict):
        fail(f"{index_mdx}: frontmatter must be a YAML mapping")
    title = meta.get("title")
    order = meta.get("order")
    if not isinstance(title, str) or not title.strip():
        fail(f"{index_mdx}: frontmatter.title must be a non-empty string")
    if not isinstance(order, int) or isinstance(order, bool):
        fail(f"{index_mdx}: frontmatter.order must be an integer")
    return {"title": title.strip(), "order": order, "slug": index_mdx.parent.name}


def load_chapters() -> list[tuple[dict, list[dict]]]:
    """Chapters (frontmatter, flashcards) sorted by frontmatter order."""
    chapters: list[tuple[dict, list[dict]]] = []
    for entry in sorted(CHAPTERS_DIR.iterdir()):
        if not entry.is_dir():
            continue
        flashcards_file = entry / "flashcards.yaml"
        if not flashcards_file.exists():
            continue
        cards = yaml.safe_load(flashcards_file.read_text(encoding="utf-8"))
        if not isinstance(cards, list):
            fail(f"{flashcards_file}: expected a YAML array of flashcards")
        chapters.append((chapter_frontmatter(entry / "index.mdx"), cards))
    if not chapters:
        fail(f"no chapters with flashcards found under {CHAPTERS_DIR}")
    chapters.sort(key=lambda pair: (pair[0]["order"], pair[0]["slug"]))
    return chapters


def deck_id_for(name: str, seen: dict[str, int]) -> int:
    """Stable deck id from the deck name (crc32); rejects collisions loudly."""
    did = zlib.crc32(name.encode("utf-8"))
    if did in seen.values():
        fail(f"deck id collision for {name!r} (crc32 {did}) — rename the deck")
    seen[name] = did
    return did


def build_report(chapters: list[tuple[dict, list[dict]]]) -> dict:
    """Validate flashcards and assemble the full deck data structure."""
    empty_fields: list[str] = []
    seen_ids: dict[str, str] = {}
    decks: list[dict] = []
    notes: list[dict] = []

    for meta, cards in chapters:
        deck_name = f"{DECK_ROOT}::{meta['order']:02d} {meta['title']}"
        decks.append({"name": deck_name, "notes": len(cards)})
        for card in cards:
            card_id = card.get("id")
            front = card.get("front")
            back = card.get("back")
            if not isinstance(card_id, str) or not card_id:
                fail(f"{deck_name}: flashcard missing non-empty 'id': {card!r}")
            if card_id in seen_ids:
                fail(
                    f"duplicate flashcard id {card_id!r} in {deck_name} "
                    f"(already used in {seen_ids[card_id]})"
                )
            seen_ids[card_id] = deck_name
            for field, value in (("front", front), ("back", back)):
                if not isinstance(value, str) or not value.strip():
                    empty_fields.append(f"{deck_name}:{card_id}:{field}")
            tags = card.get("tags") or []
            notes.append(
                {
                    "id": card_id,
                    "deck": deck_name,
                    "guid": genanki.guid_for(card_id),
                    "front": front if isinstance(front, str) else "",
                    "back": back if isinstance(back, str) else "",
                    "tags": [str(t) for t in tags],
                }
            )

    return {
        "parentDeck": DECK_ROOT,
        "totalNotes": len(notes),
        "decks": decks,
        "emptyFields": empty_fields,
        "notes": notes,
    }


FIELD_SEPARATOR = "\x1f"  # Anki's notes.flds separator; model order: Front, Back, Tags


def inspect_package(apkg_path: Path) -> dict:
    """Re-derive deck data from a committed .apkg. READ-ONLY: the zip is read
    and collection.anki2 is loaded into an in-memory sqlite database — the
    package (and everything else on disk) is never written to."""
    if not apkg_path.exists():
        fail(f"{apkg_path}: no such file")
    with zipfile.ZipFile(apkg_path) as archive:
        if "collection.anki2" not in archive.namelist():
            fail(f"{apkg_path}: not an Anki package (missing collection.anki2)")
        payload = archive.read("collection.anki2")

    con = sqlite3.connect(":memory:")
    con.deserialize(payload)

    deck_names = {
        int(deck_id): info["name"]
        for deck_id, info in json.loads(con.execute("SELECT decks FROM col").fetchone()[0]).items()
    }
    notes: list[dict] = []
    per_deck: dict[str, int] = {}
    for guid, flds, deck_id in con.execute(
        "SELECT n.guid, n.flds, c.did FROM notes n JOIN cards c ON c.nid = n.id"
    ):
        fields = flds.split(FIELD_SEPARATOR)
        if len(fields) != 3:
            fail(
                f"{apkg_path}: note {guid!r} has {len(fields)} fields, expected 3 "
                f"(model order Front/Back/Tags) — was the model changed?"
            )
        front, back, _tags = fields
        deck_name = deck_names.get(int(deck_id))
        if deck_name is None:
            fail(f"{apkg_path}: card for note {guid!r} points at unknown deck id {deck_id}")
        # Report shape parity with --dry-run: chapter decks only (the parent and
        # Anki's Default hold no cards).
        if deck_name == DECK_ROOT or deck_name == "Default":
            continue
        per_deck[deck_name] = per_deck.get(deck_name, 0) + 1
        notes.append({"guid": guid, "front": front, "back": back, "deck": deck_name})
    con.close()

    return {
        "parentDeck": DECK_ROOT,
        "totalNotes": len(notes),
        "decks": [{"name": name, "notes": count} for name, count in sorted(per_deck.items())],
        "notes": sorted(notes, key=lambda n: n["guid"]),
    }


def package_deck(report: dict, out_path: Path) -> None:
    if report["emptyFields"]:
        fail(f"refusing to package: empty fields in {report['emptyFields']}")

    seen_ids: dict[str, int] = {}
    model = genanki.Model(
        MODEL_ID,
        MODEL_NAME,
        fields=[{"name": "Front"}, {"name": "Back"}, {"name": "Tags"}],
        templates=[
            {
                "name": "Front -> Back",
                "qfmt": "{{Front}}",
                "afmt": '{{Front}}<hr id="answer">{{Back}}',
            }
        ],
        css=CSS,
    )

    parent = genanki.Deck(deck_id_for(DECK_ROOT, seen_ids), DECK_ROOT)
    decks_by_name: dict[str, genanki.Deck] = {}
    for deck in report["decks"]:
        decks_by_name[deck["name"]] = genanki.Deck(deck_id_for(deck["name"], seen_ids), deck["name"])

    for note in report["notes"]:
        deck = decks_by_name[note["deck"]]
        deck.add_note(
            genanki.Note(
                model=model,
                fields=[note["front"], note["back"], " ".join(note["tags"])],
                guid=note["guid"],
                tags=note["tags"],
            )
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    genanki.Package([parent, *decks_by_name.values()]).write_to_file(str(out_path))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print deck data as JSON (no packaging); exit 1 if the data is dirty",
    )
    parser.add_argument(
        "--inspect",
        type=Path,
        metavar="PATH.APKG",
        help="read-only: print deck data re-derived from a committed .apkg as JSON",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output .apkg path")
    args = parser.parse_args()

    if args.inspect is not None:
        print(json.dumps(inspect_package(args.inspect), indent=2))
        return

    report = build_report(load_chapters())

    if args.dry_run:
        print(json.dumps(report, indent=2))
        if report["emptyFields"]:
            print(
                f"export-anki: {len(report['emptyFields'])} empty field(s) "
                f"(see emptyFields in the JSON above)",
                file=sys.stderr,
            )
            sys.exit(1)
        return

    if report["emptyFields"]:
        fail(f"refusing to package: empty fields in {report['emptyFields']}")

    package_deck(report, args.out)
    size_kb = args.out.stat().st_size / 1024
    print(
        f"wrote {args.out.relative_to(ROOT)} ({size_kb:.0f} KB): "
        f"{report['totalNotes']} notes across {len(report['decks']) + 1} decks "
        f"(1 parent + {len(report['decks'])} chapter decks)"
    )


if __name__ == "__main__":
    main()
