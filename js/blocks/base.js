/* ============================================================
   base.js
   The plugin system. To add a NEW block type:
     1. Create a class extending BaseBlock (see questionnaireCounter.js,
        sleep.js, bottle.js, meal.js, diary.js for examples).
     2. Implement the static getters + the two instance methods.
     3. Call BlockRegistry.register(YourClass) — see blocks/index.js.
   That's it: it will show up in "add block to layout" automatically,
   and render/save automatically wherever layouts use it.
   ============================================================ */

window.BlockRegistry = (function () {
  const types = {};
  return {
    register(cls) { types[cls.typeKey] = cls; },
    get(typeKey) { return types[typeKey]; },
    all() { return Object.values(types); }
  };
})();

/**
 * Every block, whether a simple questionnaire/counter field or a composite
 * "main" block like Sleep, extends this.
 *
 * A block instance corresponds to ONE ROW in a layout CSV
 * ({order, type, name, info}), and — for a given date — renders itself and
 * knows how to save its current values back to the right CSV table(s).
 */
window.BaseBlock = class BaseBlock {
  // ---- required overrides ------------------------------------------------
  static get typeKey() { throw new Error("typeKey not implemented"); }
  static get label() { throw new Error("label not implemented"); }

  /** Whether this block's card starts collapsed. Main blocks (sleep/bottle/meal) override this to true. */
  static get defaultCollapsed() { return false; }
  /**
   * Renders the small config form used inside the "add block" layout editor
   * (e.g. asking for a question name / subtype / increment).
   * Must call onChange(infoString, nameString) whenever the config is valid,
   * so the editor can enable its "add" button.
   * Returns nothing; mutates `container`.
   */
  static renderConfigEditor(container, onChange) {
    container.innerHTML = `<p class="muted">No configuration needed.</p>`;
    onChange("", "");
  }

  /**
   * Renders this block's UI for the given date into `container`.
   * ctx = { date: Date, dataStore, layoutRow: {order,type,name,info} }
   * Must store enough on `this` to answer save(ctx) later.
   */
  async renderInstance(container, ctx) {
    container.innerHTML = `<p class="muted">Unimplemented block: ${this.constructor.typeKey}</p>`;
  }

  /** Persists current on-screen values for ctx.date. Called on the global Save click. */
  async save(ctx) { /* no-op by default */ }

  constructor(layoutRow) {
    this.layoutRow = layoutRow; // {order, type, name, info}
  }
};
