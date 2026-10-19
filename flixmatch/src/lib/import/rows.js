// Lecture d'un fichier d'export (CSV ou JSON) en lignes plates
import { parseCsv } from "./csv.js";
import { flatten, jsonRecords } from "./model.js";

// Renvoie { rows, records } : rows = lignes plates, records = objets JSON d'origine (null pour un CSV)
export function readRows(file) {
  const lower = String(file.name || "").toLowerCase();
  if (lower.endsWith(".csv")) return { rows: parseCsv(file.text), records: null };
  if (lower.endsWith(".json")) {
    const records = jsonRecords(file.text);
    if (!records) return { rows: [], records: null };
    return { rows: records.map((r) => (r && typeof r === "object" ? flatten(r) : {})), records };
  }
  return { rows: [], records: null };
}
