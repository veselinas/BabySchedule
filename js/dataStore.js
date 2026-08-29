/* ============================================================
   dataStore.js
   Sits on top of a Store (LocalStore or OneDriveStore) and knows
   about the app's specific files:
     layout_<DDMMYY>_<n>.csv   (one per saved layout)
     layout_exceptions.csv     (one-off per-date overrides of a layout)
     QuestionnairesAndCounters.csv
     Sleep.csv
     Bottles.csv
     Meals.csv
     MealsInventory.csv
     Diary.csv
   ============================================================ */

window.TABLES = {
  QANDC: "QuestionnairesAndCounters.csv",
  SLEEP: "Sleep.csv",
  BOTTLES: "Bottles.csv",
  MEALS: "Meals.csv",
  MEALS_INVENTORY: "MealsInventory.csv",
  DIARY: "Diary.csv",
  EXCEPTIONS: "layout_exceptions.csv"
};
window.EXCEPTIONS_HEADERS = ["date", "order", "type", "name", "info"];

window.DataStore = class DataStore {
  constructor(store) {
    this.store = store;
    this._tableCache = {}; // filename -> {headers, rows}
  }

  // ---------- date helpers -------------------------------------------
  static dateCode(dateObj) {
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const yy = String(dateObj.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }

  // ---------- layouts ---------------------------------------------------
  async listLayoutFiles() {
    const files = await this.store.listFiles();
    return files
      .filter(f => /^layout_\d{6}_\d+\.csv$/.test(f))
      .sort(); // lexical sort works because DDMMYY + numeric suffix both fixed width-ish; see getLatestLayout for a robust pick
  }

  /** Returns the filename of the most recently *created* layout (by embedded date+version), or null. */
  async getLatestLayoutFilename() {
    const files = await this.listLayoutFiles();
    if (!files.length) return null;
    const parsed = files.map(f => {
      const m = f.match(/^layout_(\d{2})(\d{2})(\d{2})_(\d+)\.csv$/);
      const [, dd, mm, yy, ver] = m;
      // sortable key: yy mm dd then version
      return { file: f, key: `${yy}${mm}${dd}_${ver.padStart(4, "0")}` };
    });
    parsed.sort((a, b) => a.key.localeCompare(b.key));
    return parsed[parsed.length - 1].file;
  }

  async readLayout(filename) {
    const text = await this.store.readFile(filename);
    if (text === null) return { headers: ["order", "type", "name", "info"], rows: [] };
    const { headers, rows } = CSVUtil.parse(text);
    rows.forEach(r => { r.order = Number(r.order); });
    rows.sort((a, b) => a.order - b.order);
    return { headers, rows };
  }

  /** Saves a new layout for "today" (or a given date), auto-picking the next version suffix. */
  async saveNewLayout(blockConfigs, forDate) {
    const dateCode = DataStore.dateCode(forDate || new Date());
    const existing = await this.listLayoutFiles();
    const versions = existing
      .filter(f => f.startsWith(`layout_${dateCode}_`))
      .map(f => Number(f.match(/_(\d+)\.csv$/)[1]));
    const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;
    const filename = `layout_${dateCode}_${nextVersion}.csv`;
    const headers = ["order", "type", "name", "info"];
    const rows = blockConfigs.map((c, i) => ({
      order: i + 1, type: c.type, name: c.name, info: c.info || ""
    }));
    const text = CSVUtil.toCSV(rows, headers);
    await this.store.writeFile(filename, text);
    return filename;
  }

  // ---------- per-date layout exceptions ---------------------------------
  /** Rows for one date from layout_exceptions.csv, in order — [] if none. */
  async readExceptionsForDate(dateCode) {
    const { rows } = await this.readTable(TABLES.EXCEPTIONS, EXCEPTIONS_HEADERS);
    return rows
      .filter(r => r.date === dateCode)
      .map(r => ({ order: Number(r.order), type: r.type, name: r.name, info: r.info }))
      .sort((a, b) => a.order - b.order);
  }

  /** Overwrites the exception rows for one date with the given block configs. */
  async saveExceptionsForDate(dateCode, blockConfigs) {
    const rows = blockConfigs.map((c, i) => ({
      date: dateCode, order: i + 1, type: c.type, name: c.name, info: c.info || ""
    }));
    await this.upsertRows(TABLES.EXCEPTIONS, EXCEPTIONS_HEADERS, r => r.date === dateCode, rows);
  }

  /** Removes any exception rows for one date, reverting it back to the default layout. */
  async clearExceptionsForDate(dateCode) {
    await this.upsertRows(TABLES.EXCEPTIONS, EXCEPTIONS_HEADERS, r => r.date === dateCode, []);
  }

  /**
   * The blocks that should actually be shown for `date`: the day's exceptions
   * if any exist, otherwise the given default layout file's blocks.
   * Returns { rows, isException }.
   */
  async getEffectiveLayoutRows(layoutFile, date) {
    const dateCode = DataStore.dateCode(date);
    const exceptionRows = await this.readExceptionsForDate(dateCode);
    if (exceptionRows.length) return { rows: exceptionRows, isException: true };
    if (!layoutFile) return { rows: [], isException: false };
    const { rows } = await this.readLayout(layoutFile);
    return { rows, isException: false };
  }

  // ---------- generic table access --------------------------------------
  async readTable(filename, headersIfMissing) {
    if (this._tableCache[filename]) return this._tableCache[filename];
    const text = await this.store.readFile(filename);
    const parsed = text === null
      ? { headers: headersIfMissing || [], rows: [] }
      : CSVUtil.parse(text);
    this._tableCache[filename] = parsed;
    return parsed;
  }

  async writeTable(filename, rows, headers) {
    const text = CSVUtil.toCSV(rows, headers);
    await this.store.writeFile(filename, text);
    this._tableCache[filename] = { headers, rows };
  }

  /**
   * Replaces rows whose key matches `matchFn` with `newRows`, keeping everything else, then writes.
   * matchFn(row) -> boolean, applied to EXISTING rows to decide what gets removed before newRows are appended.
   */
  async upsertRows(filename, headers, matchFn, newRows) {
    const { rows } = await this.readTable(filename, headers);
    const kept = rows.filter(r => !matchFn(r));
    const finalRows = kept.concat(newRows);
    await this.writeTable(filename, finalRows, headers);
  }

  clearCache() { this._tableCache = {}; }
};
