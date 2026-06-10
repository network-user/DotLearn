import io
import json
import os
import sys
from contextlib import redirect_stdout

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INTERVIEW = os.path.join(ROOT, "interview")

stats = {"py_cases": 0, "py_fixed": 0, "po_checked": 0, "po_fixed": 0}
errors = []


def numbers(a, b):
    return isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool)


def equal(actual, expected):
    if numbers(actual, expected):
        return abs(actual - expected) <= 1e-9
    return actual == expected


def run_function(block, file, exid):
    changed = False
    solution = block.get("solution")
    cases = block.get("cases")
    if not isinstance(solution, str) or not isinstance(cases, list):
        return changed
    for case in cases:
        call = case.get("call")
        if not isinstance(call, str):
            continue
        stats["py_cases"] += 1
        ns = {}
        try:
            exec(solution, ns)
            actual = eval(call, ns)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{file} :: {exid} :: call `{call}` raised {type(exc).__name__}: {exc}")
            continue
        if "expect_approx" in case:
            target = case["expect_approx"]
            if not (isinstance(actual, (int, float)) and abs(actual - target) <= 1e-6):
                if isinstance(actual, (int, float)):
                    case["expect_approx"] = actual
                    stats["py_fixed"] += 1
                    changed = True
                else:
                    errors.append(f"{file} :: {exid} :: approx case `{call}` produced non-number {actual!r}")
        else:
            if not equal(actual, case.get("expect")):
                case["expect"] = actual
                stats["py_fixed"] += 1
                changed = True
    return changed


def run_predict(block, file, exid):
    changed = False
    snippet = block.get("snippet")
    expected = block.get("expected")
    if not isinstance(snippet, str) or not isinstance(expected, dict):
        return changed
    if expected.get("kind") != "stdout":
        return changed
    stats["po_checked"] += 1
    buffer = io.StringIO()
    ns = {}
    try:
        with redirect_stdout(buffer):
            exec(snippet, ns)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"{file} :: {exid} :: snippet raised {type(exc).__name__}: {exc}")
        return changed
    actual = buffer.getvalue()
    if actual.endswith("\n"):
        actual = actual[:-1]
    if expected.get("value") != actual:
        expected["value"] = actual
        stats["po_fixed"] += 1
        changed = True
    return changed


def process_exercise(ex, file):
    changed = False
    exid = ex.get("id", "?")
    kind = ex.get("type")
    blocks = [ex] + (ex.get("variants") or [])
    for block in blocks:
        if kind == "python-function":
            changed |= run_function(block, file, exid)
        elif kind == "predict-output":
            changed |= run_predict(block, file, exid)
    return changed


def main():
    files = 0
    changed_files = 0
    for category in sorted(os.listdir(INTERVIEW)):
        cdir = os.path.join(INTERVIEW, category)
        if not os.path.isdir(cdir):
            continue
        for name in sorted(os.listdir(cdir)):
            if not name.endswith(".exercises.json"):
                continue
            files += 1
            path = os.path.join(cdir, name)
            rel = f"{category}/{name}"
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
            changed = False
            for ex in data.get("exercises", []):
                changed |= process_exercise(ex, rel)
            if changed:
                changed_files += 1
                with open(path, "w", encoding="utf-8") as fh:
                    json.dump(data, fh, ensure_ascii=False, indent=2)
                    fh.write("\n")

    print(f"Files: {files}, rewritten: {changed_files}")
    print(
        f"python-function cases: {stats['py_cases']} (expect fixed: {stats['py_fixed']}); "
        f"predict-output stdout: {stats['po_checked']} (value fixed: {stats['po_fixed']})"
    )
    print(f"Unresolved errors (need manual/agent fix): {len(errors)}")
    for e in errors[:50]:
        print("  !", e)
    if errors:
        sys.exit(2)


if __name__ == "__main__":
    main()
