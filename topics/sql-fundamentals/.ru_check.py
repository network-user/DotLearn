import yaml, json, re, sys, os

base = os.path.dirname(os.path.abspath(__file__))
names = ["01-select","02-ordering","03-aggregation","04-joins","05-grouping","06-subqueries"]
ok = True

for n in names:
    en = yaml.safe_load(open(os.path.join(base, f"exercises/{n}.en.yaml"), encoding="utf-8"))
    ru = yaml.safe_load(open(os.path.join(base, f"exercises/{n}.ru.yaml"), encoding="utf-8"))
    en_ids = [e["id"] for e in en["exercises"]]
    ru_ids = [e["id"] for e in ru["exercises"]]
    match = en_ids == ru_ids
    print(f"{n}: id order match = {match}, ids = {ru_ids}")
    if not match:
        ok = False
        print("  EN:", en_ids, "RU:", ru_ids)
    for e_en, e_ru in zip(en["exercises"], ru["exercises"]):
        for field in ["type","concept","difficulty","fixture","expected","solution","correct"]:
            if field in e_en or field in e_ru:
                if e_en.get(field) != e_ru.get(field):
                    ok = False
                    print(f"  MISMATCH {e_en['id']}.{field}")
        if "choices" in e_en:
            en_c = [c["id"] for c in e_en["choices"]]
            ru_c = [c["id"] for c in e_ru.get("choices",[])]
            if en_c != ru_c:
                ok = False
                print(f"  CHOICE ID MISMATCH {e_en['id']}: {en_c} vs {ru_c}")

m = json.load(open(os.path.join(base, "manifest.json"), encoding="utf-8"))
print("manifest: valid JSON, languages =", m["availableLanguages"], ", primary =", m["primaryLanguage"], ", version =", m["version"])
for c in m["concepts"]:
    assert len(c["theoryFiles"]) == 2 and c["theoryFiles"][0].endswith(".ru.mdx"), c["id"]
    assert len(c["exerciseFiles"]) == 2 and c["exerciseFiles"][0].endswith(".ru.yaml"), c["id"]
print("manifest: every concept lists ru first, en second")

def code_blocks(path):
    text = open(path, encoding="utf-8").read()
    fenced = re.findall(r"```sql\n(.*?)```", text, re.S)
    props = re.findall(r"(?:fixture|query)=\{`(.*?)`\}", text, re.S)
    return fenced + props

for n in names:
    en_b = code_blocks(os.path.join(base, f"theory/{n}.en.mdx"))
    ru_b = code_blocks(os.path.join(base, f"theory/{n}.ru.mdx"))
    same = en_b == ru_b
    print(f"theory {n}: {len(en_b)} SQL blocks, identical = {same}")
    if not same:
        ok = False
        for i,(a,b) in enumerate(zip(en_b, ru_b)):
            if a != b:
                print(f"  block {i} differs")

print("RESULT:", "ALL OK" if ok else "FAILURES FOUND")
sys.exit(0 if ok else 1)
