/* ============================================================
   bottle.js
   Composite "main" block: Bottle feeding. Persists to Bottles.csv.
   (Quantity increments default to 10ml — adjust BOTTLE_QC_FIELDS below
   if your bottles are measured differently.)
   ============================================================ */

window.BOTTLE_QC_FIELDS = [
  { key: "quantity_taken", label: "Quantity taken (ml)", subtype: "counter", increment: 10 },
  { key: "quantity_offered", label: "Quantity offered (ml)", subtype: "counter", increment: 10 },
  { key: "reflux", label: "Reflux", subtype: "rating" },
  { key: "burp", label: "Burp", subtype: "rating" },
  { key: "possibly_overfeeding", label: "Possibly overfeeding", subtype: "binary" },
  { key: "thickener", label: "Thickener", subtype: "binary" },
  { key: "enough_time_upright", label: "Enough time upright", subtype: "binary" }
];

window.BOTTLE_HEADERS = [
  "date", "block_id", "time",
  ...BOTTLE_QC_FIELDS.map(f => f.key),
  "notes"
];

window.BottleBlock = class BottleBlock extends BaseBlock {
  static get typeKey() { return "bottle"; }
  static get label() { return "Bottle feeding"; }

  static renderConfigEditor(container, onChange) {
    container.innerHTML = `<p class="muted">A bottle feed entry — no extra setup needed.</p>`;
    onChange("", "Bottle feeding");
  }

  async renderInstance(container, ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const dateCode = DataStore.dateCode(date);
    const blockId = String(layoutRow.order);
    const { rows } = await dataStore.readTable(TABLES.BOTTLES, BOTTLE_HEADERS);
    const existing = rows.find(r => r.date === dateCode && r.block_id === blockId);

    const wrap = document.createElement("div");
    wrap.className = "main-block-body";

    const timeRow = document.createElement("div");
    timeRow.className = "field-row field-inline";
    timeRow.innerHTML = `<label>Time <input type="time" class="bottle-time" /></label>`;
    wrap.appendChild(timeRow);
    const timeEl = timeRow.querySelector(".bottle-time");
    timeEl.value = existing ? existing.time : "";

    const widgets = {};
    BOTTLE_QC_FIELDS.forEach(f => {
      const widget = FieldWidgets.createFieldWidget({
        name: f.label, subtype: f.subtype, increment: f.increment,
        initialValue: existing ? existing[f.key] : undefined
      });
      wrap.appendChild(widget.el);
      widgets[f.key] = widget;
    });

    const notesRow = document.createElement("div");
    notesRow.className = "field-row";
    notesRow.innerHTML = `<div class="field-label">Notes</div>`;
    const notesArea = document.createElement("textarea");
    notesArea.className = "notes-textarea";
    notesArea.value = existing ? existing.notes : "";
    notesRow.appendChild(notesArea);
    wrap.appendChild(notesRow);

    container.appendChild(wrap);

    this._collect = () => {
      const row = { date: dateCode, block_id: blockId, time: timeEl.value, notes: notesArea.value };
      BOTTLE_QC_FIELDS.forEach(f => { row[f.key] = widgets[f.key].getValue(); });
      return row;
    };
  }

  async save(ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const dateCode = DataStore.dateCode(date);
    const blockId = String(layoutRow.order);
    const row = this._collect();
    await dataStore.upsertRows(
      TABLES.BOTTLES, BOTTLE_HEADERS,
      r => r.date === dateCode && r.block_id === blockId,
      [row]
    );
  }
};
