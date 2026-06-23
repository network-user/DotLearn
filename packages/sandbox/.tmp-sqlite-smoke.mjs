import { loadPyodide } from 'pyodide';

const py = await loadPyodide();
// Replicates the worker's init order: preload the curated package, THEN run lesson code.
await py.loadPackage(['sqlite3'], { messageCallback: () => undefined });

const out = py.runPython(`
import sqlite3
conn = sqlite3.connect(":memory:")
cur = conn.cursor()
cur.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)")
cur.execute("INSERT INTO users (name, age) VALUES ('Анна', 30), ('Борис', 17)")
conn.commit()

name = "'; DROP TABLE users; --"
rows = cur.execute("SELECT name, age FROM users WHERE name = ?", (name,)).fetchall()
intact = cur.execute("SELECT count(*) FROM users").fetchone()[0]
str({"attack_rows": rows, "table_rows_after_attack": intact})
`);
console.log('OK:', out);
