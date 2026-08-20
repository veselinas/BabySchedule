/* ============================================================
   fieldWidgets.js
   Pure UI building blocks for a single questionnaire/counter field.
   Used both by QuestionnaireCounterBlock (top-level layout rows) and
   by the composite main blocks (Sleep/Bottle/Meal) which embed several
   of these inline. This is the "reuse counters/questionnaires inside
   main blocks" requirement.
   ============================================================ */

window.FieldWidgets = (function () {

  /** Parses an "info" string for a questionnaire_counter layout row.
   *  "binary"                -> {subtype:'binary'}
   *  "rating"                 -> {subtype:'rating'}
   *  "counter_0.5_1"          -> {subtype:'counter', increment:0.5, defaultMode:1}
   */
  function parseInfo(info) {
    if (info === "binary") return { subtype: "binary" };
    if (info === "rating") return { subtype: "rating" };
    const m = /^counter_([\d.]+)_(\d)$/.exec(info || "");
    if (m) return { subtype: "counter", increment: parseFloat(m[1]), defaultMode: Number(m[2]) };
    return { subtype: "binary" };
  }

  function toInfo(subtype, increment, defaultMode) {
    if (subtype === "counter") return `counter_${increment}_${defaultMode}`;
    return subtype;
  }

  /**
   * Builds one field row (label + control).
   * opts: { name, subtype, increment, defaultMode, initialValue, resolveLastValue }
   *   resolveLastValue: optional () -> number|null, used when defaultMode===1 and no initialValue exists
   * Returns { el, getValue(), setValue(v) }
   */
  function createFieldWidget(opts) {
    const { name, subtype } = opts;
    const row = document.createElement("div");
    row.className = `field-row field-${subtype}`;

    let getValue, setValue;

    if (subtype === "binary") {
      const label = document.createElement("label");
      label.className = "field-binary";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = opts.initialValue === "yes";
      const span = document.createElement("span");
      span.textContent = name;
      label.appendChild(cb);
      label.appendChild(span);
      row.appendChild(label);
      getValue = () => (cb.checked ? "yes" : "no");
      setValue = v => { cb.checked = v === "yes"; };

    } else if (subtype === "rating") {
      const label = document.createElement("div");
      label.className = "field-label";
      label.textContent = name;
      row.appendChild(label);
      const group = document.createElement("div");
      group.className = "field-rating-group";
      const groupName = `rating_${name}_${Math.random().toString(36).slice(2)}`;
      RATING_OPTIONS.forEach(opt => {
        const optLabel = document.createElement("label");
        optLabel.className = "field-rating-option";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = groupName;
        radio.value = opt;
        if (opts.initialValue === opt) radio.checked = true;
        optLabel.appendChild(radio);
        optLabel.appendChild(document.createTextNode(" " + opt));
        group.appendChild(optLabel);
      });
      row.appendChild(group);
      getValue = () => {
        const checked = group.querySelector("input:checked");
        return checked ? checked.value : "";
      };
      setValue = v => {
        const target = group.querySelector(`input[value="${v}"]`);
        if (target) target.checked = true;
      };

    } else { // counter
      const label = document.createElement("div");
      label.className = "field-label";
      label.textContent = name;
      row.appendChild(label);

      const wrap = document.createElement("div");
      wrap.className = "field-counter";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "counter-btn";
      minus.textContent = "−";
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.className = "counter-input";
      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "counter-btn";
      plus.textContent = "+";

      let startValue = opts.initialValue !== undefined && opts.initialValue !== ""
        ? parseFloat(opts.initialValue)
        : null;
      if (startValue === null && opts.defaultMode === 1 && typeof opts.resolveLastValue === "function") {
        const last = opts.resolveLastValue();
        startValue = (last === null || last === undefined) ? 0 : parseFloat(last);
      }
      if (startValue === null || isNaN(startValue)) startValue = 0;
      input.value = startValue;

      const inc = opts.increment || 1;
      minus.addEventListener("click", () => {
        input.value = (parseFloat(input.value || 0) - inc).toFixed(6).replace(/\.?0+$/, "") || "0";
      });
      plus.addEventListener("click", () => {
        input.value = (parseFloat(input.value || 0) + inc).toFixed(6).replace(/\.?0+$/, "") || "0";
      });

      wrap.appendChild(minus);
      wrap.appendChild(input);
      wrap.appendChild(plus);
      row.appendChild(wrap);

      getValue = () => input.value === "" ? "0" : String(parseFloat(input.value));
      setValue = v => { input.value = v; };
    }

    return { el: row, getValue, setValue };
  }

  return { parseInfo, toInfo, createFieldWidget };
})();
