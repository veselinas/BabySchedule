/* ============================================================
   sleep.js
   Composite "main" block: Sleep. Persists to Sleep.csv.
   Note: a `block_id` column (= the block's position/order in its layout)
   is added alongside `date` so that multiple sleep entries logged on the
   same day (as in the example layout, which has three Sleep blocks) don't
   overwrite each other. Same pattern is used by bottle.js and meal.js.
   ============================================================ */

window.SLEEP_QC_FIELDS = [
  { key: "possibly_overtired", label: "Possibly overtired", subtype: "binary" },
  { key: "possibly_not_tired", label: "Possibly not tired", subtype: "binary" },
  { key: "getting_to_sleep", label: "Getting to sleep", subtype: "rating" },
  { key: "disturbed", label: "Disturbed", subtype: "binary" },
  { key: "sleep_quality", label: "Sleep quality", subtype: "rating" },
  { key: "wake_up_mood", label: "Wake up mood", subtype: "rating" },
  { key: "calming_activities_before_bed", label: "Calming activities before bed", subtype: "binary" }
];

window.SLEEP_NIGHT_ONLY_FIELDS = [
  { key: "water", label: "Water", subtype: "counter", increment: 5 },
  { key: "milk", label: "Milk", subtype: "counter", increment: 10 },
  { key: "awake_periods", label: "Awake periods", subtype: "counter", increment: 1 },
  { key: "awake_duration_minutes", label: "Awake duration (minutes)", subtype: "counter", increment: 10 }
];

window.SLEEP_HEADERS = [
  "date", "block_id", "type", "start_time", "end_time", "duration", "location",
  ...SLEEP_QC_FIELDS.map(f => f.key),
  ...SLEEP_NIGHT_ONLY_FIELDS.map(f => f.key),
  "notes"
];

function computeDuration(start, end) {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // crosses midnight
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h ${m}m`;
}

window.SleepBlock = class SleepBlock extends BaseBlock {
  static get typeKey() { return "sleep"; }
  static get label() { return "Sleep"; }

  static renderConfigEditor(container, onChange) {
    container.innerHTML = `<p class="muted">A sleep entry — no extra setup needed.</p>`;
    onChange("", "Sleep");
  }

  async renderInstance(container, ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const dateCode = DataStore.dateCode(date);
    const blockId = String(layoutRow.order);
    const { rows } = await dataStore.readTable(TABLES.SLEEP, SLEEP_HEADERS);
    const existing = rows.find(r => r.date === dateCode && r.block_id === blockId);

    const wrap = document.createElement("div");
    wrap.className = "main-block-body";

    // Type
    const typeRow = document.createElement("div");
    typeRow.className = "field-row";
    typeRow.innerHTML = `<div class="field-label">Type</div>`;
    const typeSelect = document.createElement("select");
    SLEEP_TYPES.forEach(t => {
      const o = document.createElement("option"); o.value = t; o.textContent = t;
      typeSelect.appendChild(o);
    });
    typeSelect.value = existing ? existing.type : "nap";
    typeRow.appendChild(typeSelect);
    wrap.appendChild(typeRow);

    // Start / End / Duration
    const timeRow = document.createElement("div");
    timeRow.className = "field-row field-inline";
    timeRow.innerHTML = `
      <label>Start <input type="time" class="sleep-start" /></label>
      <label>End <input type="time" class="sleep-end" /></label>
      <span class="sleep-duration muted"></span>
    `;
    wrap.appendChild(timeRow);
    const startEl = timeRow.querySelector(".sleep-start");
    const endEl = timeRow.querySelector(".sleep-end");
    const durEl = timeRow.querySelector(".sleep-duration");
    startEl.value = existing ? existing.start_time : "";
    endEl.value = existing ? existing.end_time : "";
    const refreshDuration = () => { durEl.textContent = "Duration: " + (computeDuration(startEl.value, endEl.value) || "—"); };
    startEl.addEventListener("input", refreshDuration);
    endEl.addEventListener("input", refreshDuration);
    refreshDuration();

    // Location
    const locRow = document.createElement("div");
    locRow.className = "field-row";
    locRow.innerHTML = `<div class="field-label">Location</div>`;
    const locSelect = document.createElement("select");
    SLEEP_LOCATIONS.forEach(l => {
      const o = document.createElement("option"); o.value = l; o.textContent = l;
      locSelect.appendChild(o);
    });
    locSelect.value = existing ? existing.location : "cot";
    locRow.appendChild(locSelect);
    wrap.appendChild(locRow);

    // Common QC fields (reused widgets)
    const qcWidgets = {};
    SLEEP_QC_FIELDS.forEach(f => {
      const widget = FieldWidgets.createFieldWidget({
        name: f.label, subtype: f.subtype,
        initialValue: existing ? existing[f.key] : undefined
      });
      wrap.appendChild(widget.el);
      qcWidgets[f.key] = widget;
    });

    // Night-only counters
    const nightWrap = document.createElement("div");
    nightWrap.className = "sleep-night-only";
    const nightWidgets = {};
    SLEEP_NIGHT_ONLY_FIELDS.forEach(f => {
      const widget = FieldWidgets.createFieldWidget({
        name: f.label, subtype: "counter", increment: f.increment,
        initialValue: existing ? existing[f.key] : undefined
      });
      nightWrap.appendChild(widget.el);
      nightWidgets[f.key] = widget;
    });
    wrap.appendChild(nightWrap);
    const toggleNight = () => { nightWrap.style.display = typeSelect.value === "night" ? "block" : "none"; };
    typeSelect.addEventListener("change", toggleNight);
    toggleNight();

    // Notes
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
      const isNight = typeSelect.value === "night";
      const row = {
        date: dateCode, block_id: blockId, type: typeSelect.value,
        start_time: startEl.value, end_time: endEl.value,
        duration: computeDuration(startEl.value, endEl.value),
        location: locSelect.value, notes: notesArea.value
      };
      SLEEP_QC_FIELDS.forEach(f => { row[f.key] = qcWidgets[f.key].getValue(); });
      SLEEP_NIGHT_ONLY_FIELDS.forEach(f => {
        row[f.key] = isNight ? nightWidgets[f.key].getValue() : "0";
      });
      return row;
    };
  }

  async save(ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const dateCode = DataStore.dateCode(date);
    const blockId = String(layoutRow.order);
    const row = this._collect();
    await dataStore.upsertRows(
      TABLES.SLEEP, SLEEP_HEADERS,
      r => r.date === dateCode && r.block_id === blockId,
      [row]
    );
  }
};
