/* ============================================================
   questionnaireCounter.js
   Top-level "questionnaire_counter" block. One question, one control
   (checkbox / rating / counter). Persists to QuestionnairesAndCounters.csv.
   ============================================================ */

window.QuestionnaireCounterBlock = class QuestionnaireCounterBlock extends BaseBlock {
  static get typeKey() { return "questionnaire_counter"; }
  static get label() { return "Question / Counter"; }

  static renderConfigEditor(container, onChange) {
    container.innerHTML = `
      <label class="form-label">Question / field name
        <input type="text" class="qc-name" placeholder="e.g. Brush teeth" />
      </label>
      <label class="form-label">Type
        <select class="qc-subtype">
          <option value="binary">Checkbox (yes/no)</option>
          <option value="rating">Rating (no/poor/average/excellent)</option>
          <option value="counter">Counter (number)</option>
        </select>
      </label>
      <div class="qc-counter-extra" style="display:none">
        <label class="form-label">Increment
          <input type="number" class="qc-increment" value="1" step="any" />
        </label>
        <label class="form-label">Default value
          <select class="qc-default-mode">
            <option value="0">Always start at 0</option>
            <option value="1">Start at last saved value</option>
          </select>
        </label>
      </div>
    `;
    const nameEl = container.querySelector(".qc-name");
    const subtypeEl = container.querySelector(".qc-subtype");
    const extraEl = container.querySelector(".qc-counter-extra");
    const incEl = container.querySelector(".qc-increment");
    const modeEl = container.querySelector(".qc-default-mode");

    function emit() {
      extraEl.style.display = subtypeEl.value === "counter" ? "block" : "none";
      const info = FieldWidgets.toInfo(subtypeEl.value, incEl.value, modeEl.value);
      onChange(info, nameEl.value.trim());
    }
    [nameEl, subtypeEl, incEl, modeEl].forEach(el => el.addEventListener("input", emit));
    emit();
  }

  async renderInstance(container, ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const cfg = FieldWidgets.parseInfo(layoutRow.info);
    const dateCode = DataStore.dateCode(date);
    const question = layoutRow.name;

    const { rows } = await dataStore.readTable(
      TABLES.QANDC, ["date", "question", "type", "answer"]
    );
    const existing = rows.find(r => r.date === dateCode && r.question === question);

    const resolveLastValue = () => {
      const history = rows
        .filter(r => r.question === question && r.date < dateCode)
        .sort((a, b) => a.date.localeCompare(b.date));
      return history.length ? history[history.length - 1].answer : null;
    };

    const widget = FieldWidgets.createFieldWidget({
      name: question,
      subtype: cfg.subtype,
      increment: cfg.increment,
      defaultMode: cfg.defaultMode,
      initialValue: existing ? existing.answer : undefined,
      resolveLastValue
    });
    container.appendChild(widget.el);
    this._widget = widget;
    this._cfg = cfg;
  }

  async save(ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const dateCode = DataStore.dateCode(date);
    const question = layoutRow.name;
    const answer = this._widget.getValue();
    await dataStore.upsertRows(
      TABLES.QANDC,
      ["date", "question", "type", "answer"],
      r => r.date === dateCode && r.question === question,
      [{ date: dateCode, question, type: this._cfg.subtype, answer }]
    );
  }
};
