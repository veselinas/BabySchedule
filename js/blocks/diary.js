/* ============================================================
   diary.js
   Composite block: Diary. Persists to Diary.csv with columns
   date, block_id, type, note — where type is one of
   milestone | memory | mood | notes (mirrors the spec's Diary table).
   ============================================================ */

window.DIARY_HEADERS = ["date", "block_id", "type", "note"];

window.DiaryBlock = class DiaryBlock extends BaseBlock {
  static get typeKey() { return "diary"; }
  static get label() { return "Diary"; }

  static renderConfigEditor(container, onChange) {
    container.innerHTML = `<p class="muted">A diary entry — no extra setup needed.</p>`;
    onChange("", "Diary");
  }

  async renderInstance(container, ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const dateCode = DataStore.dateCode(date);
    const blockId = String(layoutRow.order);
    const { rows } = await dataStore.readTable(TABLES.DIARY, DIARY_HEADERS);
    const mine = rows.filter(r => r.date === dateCode && r.block_id === blockId);

    const wrap = document.createElement("div");
    wrap.className = "main-block-body";

    function buildFreeTextList(title, type) {
      const section = document.createElement("div");
      section.className = "diary-list-section";
      section.innerHTML = `
        <div class="meal-items-header"><span>${title}</span>
          <button type="button" class="add-row-btn" title="Add ${title.toLowerCase()}">&#10133;</button>
        </div>
        <div class="diary-rows"></div>
      `;
      const rowsWrap = section.querySelector(".diary-rows");
      const entries = [];
      function addRow(text) {
        const rowEl = document.createElement("div");
        rowEl.className = "diary-row";
        const input = document.createElement("input");
        input.type = "text";
        input.value = text || "";
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-row-btn";
        removeBtn.innerHTML = "&#10005;";
        removeBtn.addEventListener("click", () => {
          rowEl.remove();
          const idx = entries.indexOf(entry);
          if (idx >= 0) entries.splice(idx, 1);
        });
        rowEl.appendChild(input);
        rowEl.appendChild(removeBtn);
        const entry = { el: rowEl, getValue: () => input.value.trim() };
        entries.push(entry);
        rowsWrap.appendChild(rowEl);
      }
      const existingTexts = mine.filter(r => r.type === type).map(r => r.note);
      if (existingTexts.length) existingTexts.forEach(addRow);
      section.querySelector(".add-row-btn").addEventListener("click", () => addRow(""));
      return { el: section, getValues: () => entries.map(e => e.getValue()).filter(Boolean) };
    }

    const milestones = buildFreeTextList("Milestones", "milestone");
    const memories = buildFreeTextList("Memories", "memory");
    wrap.appendChild(milestones.el);
    wrap.appendChild(memories.el);

    // Mood
    const moodRow = document.createElement("div");
    moodRow.className = "field-row";
    moodRow.innerHTML = `<div class="field-label">Mood</div>`;
    const moodSelect = document.createElement("select");
    const blankOpt = document.createElement("option");
    blankOpt.value = ""; blankOpt.textContent = "—";
    moodSelect.appendChild(blankOpt);
    MOOD_OPTIONS.forEach(m => { const o = document.createElement("option"); o.value = m; o.textContent = m; moodSelect.appendChild(o); });
    const existingMood = mine.find(r => r.type === "mood");
    moodSelect.value = existingMood ? existingMood.note : "";
    moodRow.appendChild(moodSelect);
    wrap.appendChild(moodRow);

    // Notes
    const notesRow = document.createElement("div");
    notesRow.className = "field-row";
    notesRow.innerHTML = `<div class="field-label">Notes</div>`;
    const notesArea = document.createElement("textarea");
    notesArea.className = "notes-textarea";
    const existingNotes = mine.find(r => r.type === "notes");
    notesArea.value = existingNotes ? existingNotes.note : "";
    notesRow.appendChild(notesArea);
    wrap.appendChild(notesRow);

    container.appendChild(wrap);

    this._collect = () => {
      const out = [];
      milestones.getValues().forEach(v => out.push({ date: dateCode, block_id: blockId, type: "milestone", note: v }));
      memories.getValues().forEach(v => out.push({ date: dateCode, block_id: blockId, type: "memory", note: v }));
      if (moodSelect.value) out.push({ date: dateCode, block_id: blockId, type: "mood", note: moodSelect.value });
      if (notesArea.value.trim()) out.push({ date: dateCode, block_id: blockId, type: "notes", note: notesArea.value.trim() });
      return out;
    };
  }

  async save(ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const dateCode = DataStore.dateCode(date);
    const blockId = String(layoutRow.order);
    const newRows = this._collect();
    await dataStore.upsertRows(
      TABLES.DIARY, DIARY_HEADERS,
      r => r.date === dateCode && r.block_id === blockId,
      newRows
    );
  }
};
