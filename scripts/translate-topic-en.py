#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import sys
import time
from pathlib import Path

try:
    from deep_translator import GoogleTranslator
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "deep-translator", "-q"])
    from deep_translator import GoogleTranslator

CYRILLIC = re.compile(r"[\u0400-\u04FF]")
CACHE: dict[str, str] = {}
CHUNK = 4000


def has_cyrillic(text: str) -> bool:
    return bool(CYRILLIC.search(text))


def translate_text(text: str, translator: GoogleTranslator) -> str:
    stripped = text.strip()
    if not stripped or not has_cyrillic(text):
        return text
    if stripped in CACHE:
        return text.replace(stripped, CACHE[stripped]) if stripped != text else CACHE[stripped]
    leading = text[: len(text) - len(text.lstrip())]
    trailing = text[len(text.rstrip()) :]
    core = text.strip()
    if core in CACHE:
        return leading + CACHE[core] + trailing
    parts: list[str] = []
    cursor = 0
    while cursor < len(core):
        end = min(cursor + CHUNK, len(core))
        if end < len(core):
            split = core.rfind("\n", cursor, end)
            if split > cursor:
                end = split
        chunk = core[cursor:end]
        for attempt in range(5):
            try:
                translated = translator.translate(chunk)
                break
            except Exception:
                time.sleep(1.5 * (attempt + 1))
        else:
            raise RuntimeError(f"Failed to translate chunk starting at {cursor}")
        parts.append(translated)
        cursor = end
    result = "\n".join(parts) if "\n" in core else "".join(parts)
    CACHE[core] = result
    return leading + result + trailing


def translate_yaml_value(value, translator: GoogleTranslator):
    if isinstance(value, dict):
        return {k: translate_yaml_value(v, translator) for k, v in value.items()}
    if isinstance(value, list):
        return [translate_yaml_value(v, translator) for v in value]
    if isinstance(value, str) and has_cyrillic(value):
        return translate_text(value, translator)
    return value


def translate_mdx(content: str, translator: GoogleTranslator) -> str:
    lines = content.splitlines(keepends=True)
    out: list[str] = []
    in_fence = False
    for line in lines:
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            out.append(line)
            continue
        if in_fence:
            out.append(line)
            continue
        if line.lstrip().startswith(("#", "---", "<", "import ", "export ", "from ")):
            if has_cyrillic(line) and not line.lstrip().startswith("<"):
                out.append(translate_text(line, translator))
            elif has_cyrillic(line) and line.lstrip().startswith("<"):
                out.append(translate_jsx_line(line, translator))
            else:
                out.append(line)
            continue
        if has_cyrillic(line):
            out.append(translate_text(line, translator))
        else:
            out.append(line)
    return "".join(out)


def translate_jsx_line(line: str, translator: GoogleTranslator) -> str:
    def repl(match: re.Match[str]) -> str:
        inner = match.group(1)
        if not has_cyrillic(inner):
            return match.group(0)
        return f'"{translate_text(inner, translator).strip()}"'

    return re.sub(r'"([^"\\]*(?:\\.[^"\\]*)*)"', repl, line)


def process_file(src: Path, dst: Path, translator: GoogleTranslator) -> None:
    text = src.read_text(encoding="utf-8")
    if src.suffix == ".mdx":
        translated = translate_mdx(text, translator)
    elif src.suffix == ".yaml":
        import yaml

        data = yaml.safe_load(text)
        data = translate_yaml_value(data, translator)
        translated = yaml.dump(data, allow_unicode=True, sort_keys=False, width=120)
        if not translated.endswith("\n"):
            translated += "\n"
    else:
        translated = text
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(translated, encoding="utf-8", newline="\n")


def update_manifest(manifest_path: Path) -> None:
    import json

    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    langs = data.get("availableLanguages", [])
    if "en" not in langs:
        langs.append("en")
    data["availableLanguages"] = langs
    for concept in data.get("concepts", []):
        concept["theoryFiles"] = expand_lang_files(concept.get("theoryFiles", []))
        concept["exerciseFiles"] = expand_lang_files(concept.get("exerciseFiles", []))
    manifest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def expand_lang_files(files: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for path in files:
        if path not in seen:
            out.append(path)
            seen.add(path)
        if ".ru." in path:
            en_path = path.replace(".ru.", ".en.")
            if en_path not in seen:
                out.append(en_path)
                seen.add(en_path)
    return out


def update_readme(readme_path: Path, title_en: str, body_en: str) -> None:
    text = readme_path.read_text(encoding="utf-8")
    if "## English" in text:
        return
    text = text.rstrip() + "\n\n## English\n\n" + body_en.rstrip() + "\n"
    readme_path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    topics = sys.argv[1:] or [
        "fastapi",
        "computational-complexity",
        "python-algorithms",
    ]
    translator = GoogleTranslator(source="ru", target="en")
    for slug in topics:
        topic_dir = root / "topics" / slug
        for src in sorted(topic_dir.rglob("*.ru.*")):
            dst = Path(str(src).replace(".ru.", ".en."))
            print(f"translate {src.relative_to(root)}")
            process_file(src, dst, translator)
        update_manifest(topic_dir / "manifest.json")
        print(f"updated manifest for {slug}")


if __name__ == "__main__":
    main()
