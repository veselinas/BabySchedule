/* ============================================================
   csv.js
   Thin wrapper around PapaParse so the rest of the app only ever
   deals with plain arrays of row-objects + a header list.
   ============================================================ */

window.CSVUtil = (function () {

  /** text -> { headers: string[], rows: object[] } */
  function parse(text) {
    if (!text || !text.trim()) return { headers: [], rows: [] };
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    const headers = result.meta.fields || [];
    return { headers, rows: result.data };
  }

  /** rows (array of plain objects) + explicit header order -> csv text */
  function toCSV(rows, headers) {
    if (!headers || !headers.length) {
      headers = rows.length ? Object.keys(rows[0]) : [];
    }
    const safeRows = rows.map(r => {
      const out = {};
      headers.forEach(h => { out[h] = (r[h] === undefined || r[h] === null) ? "" : r[h]; });
      return out;
    });
    return Papa.unparse({ fields: headers, data: safeRows });
  }

  return { parse, toCSV };
})();
