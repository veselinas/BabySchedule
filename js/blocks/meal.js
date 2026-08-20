/* ============================================================
   meal.js
   Composite "main" block: Meal. Persists to Meals.csv (header-level
   answers) + MealsInventory.csv (aggregated per-food rating/reaction
   history, as specified).

   Implementation note / deviation from the spec: to let you go back and
   edit a previously-logged meal's food items (not just see the aggregate),
   this block also keeps a MealItems.csv with one row per food item per
   meal-instance (date, block_id, meal, ingredients, rating, reaction).
   MealsInventory.csv is then *derived* from MealItems.csv every time a
   meal is saved, so it always matches the spec's described shape
   (meal, ingredients, rating_/reaction_ date-lists) and stays consistent.
   ============================================================ */

window.MEAL_QC_FIELDS = [
  { key: "quantity", label: "Quantity", subtype: "rating" },
  { key: "water_offered", label: "Water offered", subtype: "binary" },
  { key: "clear_when_full", label: "Clear when full", subtype: "binary" },
  { key: "hungry", label: "Hungry", subtype: "rating" },
  { key: "mess", label: "Mess", subtype: "rating" },
  { key: "chewing_abilities", label: "Chewing abilities", subtype: "rating" },
  { key: "spoon_self_feeding_abilities", label: "Spoon self-feeding abilities", subtype: "rating" },
  { key: "cup_drinking_abilities", label: "Cup drinking abilities", subtype: "rating" }
];

window.MEAL_HEADERS = [
  "date", "block_id", "type", "time",
  ...MEAL_QC_FIELDS.map(f => f.key),
  "notes"
];

window.MEAL_ITEMS_HEADERS = ["date", "block_id", "meal", "ingredients", "rating", "reaction"];
const MEAL_ITEMS_TABLE = "MealItems.csv";

const MEAL_RATING_KEY = { "not accepted": "rating_notaccepted", "neutral": "rating_neutral", "accepted": "rating_accepted" };
const MEAL_REACTION_KEY = {
  "no": "reaction_no", "ambiguous": "reaction_ambiguous", "severe": "reaction_severe",
  "rash": "reaction_rash", "itching": "reaction_itching", "reflux": "reaction_reflux"
};
window.MEAL_INVENTORY_HEADERS = [
  "meal", "ingredients",
  "rating_notaccepted", "rating_neutral", "rating_accepted",
  "reaction_no", "reaction_ambiguous", "reaction_severe", "reaction_rash", "reaction_itching", "reaction_reflux"
];

function addDateToList(csvList, dateCode) {
  const parts = (csvList || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.includes(dateCode)) parts.push(dateCode);
  return parts.join(", ");
}
function removeDateFromList(csvList, dateCode) {
  const parts = (csvList || "").split(",").map(s => s.trim()).filter(Boolean);
  return parts.filter(p => p !== dateCode).join(", ");
}

window.MealBlock = class MealBlock extends BaseBlock {
  static get typeKey() { return "meal"; }
  static get label() { return "Meal"; }

  static renderConfigEditor(container, onChange) {
    container.innerHTML = `<p class="muted">A meal entry — no extra setup needed.</p>`;
    onChange("", "Meal");
  }

  async renderInstance(container, ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const dateCode = DataStore.dateCode(date);
    const blockId = String(layoutRow.order);

    const { rows: mealRows } = await dataStore.readTable(TABLES.MEALS, MEAL_HEADERS);
    const existing = mealRows.find(r => r.date === dateCode && r.block_id === blockId);

    const { rows: itemRows } = await dataStore.readTable(MEAL_ITEMS_TABLE, MEAL_ITEMS_HEADERS);
    const { rows: invRows } = await dataStore.readTable(TABLES.MEALS_INVENTORY, MEAL_INVENTORY_HEADERS);
    const knownMeals = invRows.map(r => r.meal);
    const existingItems = itemRows.filter(r => r.date === dateCode && r.block_id === blockId);

    const wrap = document.createElement("div");
    wrap.className = "main-block-body";

    // Type + time
    const topRow = document.createElement("div");
    topRow.className = "field-row field-inline";
    topRow.innerHTML = `
      <label>Type <select class="meal-type"></select></label>
      <label>Time <input type="time" class="meal-time" /></label>
    `;
    wrap.appendChild(topRow);
    const typeSelect = topRow.querySelector(".meal-type");
    MEAL_TYPES.forEach(t => { const o = document.createElement("option"); o.value = t; o.textContent = t; typeSelect.appendChild(o); });
    typeSelect.value = existing ? existing.type : "breakfast";
    const timeEl = topRow.querySelector(".meal-time");
    timeEl.value = existing ? existing.time : "";

    // Food items table
    const itemsWrap = document.createElement("div");
    itemsWrap.className = "meal-items";
    itemsWrap.innerHTML = `
      <div class="meal-items-header">
        <span>Food items</span>
        <button type="button" class="add-row-btn" title="Add food item">&#10133;</button>
      </div>
      <div class="meal-items-list"></div>
    `;
    wrap.appendChild(itemsWrap);
    const itemsList = itemsWrap.querySelector(".meal-items-list");
    const dataListId = "meal-known-" + blockId;
    const dataList = document.createElement("datalist");
    dataList.id = dataListId;
    knownMeals.forEach(m => { const o = document.createElement("option"); o.value = m; dataList.appendChild(o); });
    wrap.appendChild(dataList);

    const itemRowsUI = [];
    function addItemRow(data) {
      const rowEl = document.createElement("div");
      rowEl.className = "meal-item-row";
      rowEl.innerHTML = `
        <input type="text" class="mi-meal" list="${dataListId}" placeholder="Meal / food" />
        <input type="text" class="mi-ingredients" placeholder="Ingredients" />
        <select class="mi-rating"></select>
        <select class="mi-reaction"></select>
        <button type="button" class="remove-row-btn" title="Remove">&#10005;</button>
      `;
      const mealEl = rowEl.querySelector(".mi-meal");
      const ingrEl = rowEl.querySelector(".mi-ingredients");
      const ratingEl = rowEl.querySelector(".mi-rating");
      const reactionEl = rowEl.querySelector(".mi-reaction");
      MEAL_ITEM_RATING_OPTIONS.forEach(o => { const opt = document.createElement("option"); opt.value = o; opt.textContent = o; ratingEl.appendChild(opt); });
      MEAL_ITEM_REACTION_OPTIONS.forEach(o => { const opt = document.createElement("option"); opt.value = o; opt.textContent = o; reactionEl.appendChild(opt); });

      mealEl.value = data.meal || "";
      ingrEl.value = data.ingredients || "";
      ratingEl.value = data.rating || MEAL_ITEM_RATING_OPTIONS[1];
      reactionEl.value = data.reaction || MEAL_ITEM_REACTION_OPTIONS[0];

      mealEl.addEventListener("input", () => {
        const match = invRows.find(r => r.meal.toLowerCase() === mealEl.value.trim().toLowerCase());
        if (match && !ingrEl.value) ingrEl.value = match.ingredients;
      });
      rowEl.querySelector(".remove-row-btn").addEventListener("click", () => {
        rowEl.remove();
        const idx = itemRowsUI.indexOf(entry);
        if (idx >= 0) itemRowsUI.splice(idx, 1);
      });

      const entry = { el: rowEl, get: () => ({ meal: mealEl.value.trim(), ingredients: ingrEl.value.trim(), rating: ratingEl.value, reaction: reactionEl.value }) };
      itemRowsUI.push(entry);
      itemsList.appendChild(rowEl);
    }
    if (existingItems.length) existingItems.forEach(addItemRow);
    else addItemRow({});
    itemsWrap.querySelector(".add-row-btn").addEventListener("click", () => addItemRow({}));

    // Remaining questionnaire/counter fields
    const widgets = {};
    MEAL_QC_FIELDS.forEach(f => {
      const widget = FieldWidgets.createFieldWidget({
        name: f.label, subtype: f.subtype,
        initialValue: existing ? existing[f.key] : undefined
      });
      wrap.appendChild(widget.el);
      widgets[f.key] = widget;
    });

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
      const mealRow = { date: dateCode, block_id: blockId, type: typeSelect.value, time: timeEl.value, notes: notesArea.value };
      MEAL_QC_FIELDS.forEach(f => { mealRow[f.key] = widgets[f.key].getValue(); });
      const items = itemRowsUI.map(r => r.get()).filter(i => i.meal);
      return { mealRow, items };
    };
    this._previousItems = existingItems;
  }

  async save(ctx) {
    const { date, dataStore, layoutRow } = ctx;
    const dateCode = DataStore.dateCode(date);
    const blockId = String(layoutRow.order);
    const { mealRow, items } = this._collect();

    await dataStore.upsertRows(
      TABLES.MEALS, MEAL_HEADERS,
      r => r.date === dateCode && r.block_id === blockId,
      [mealRow]
    );

    const newItemRows = items.map(i => ({ date: dateCode, block_id: blockId, meal: i.meal, ingredients: i.ingredients, rating: i.rating, reaction: i.reaction }));
    await dataStore.upsertRows(
      MEAL_ITEMS_TABLE, MEAL_ITEMS_HEADERS,
      r => r.date === dateCode && r.block_id === blockId,
      newItemRows
    );

    // Rebuild MealsInventory.csv from the full MealItems.csv history.
    const { rows: allItems } = await dataStore.readTable(MEAL_ITEMS_TABLE, MEAL_ITEMS_HEADERS);
    const inventory = {}; // meal(lowercase) -> row
    allItems.forEach(item => {
      const key = item.meal.toLowerCase();
      if (!inventory[key]) {
        inventory[key] = { meal: item.meal, ingredients: item.ingredients || "" };
        MEAL_INVENTORY_HEADERS.slice(2).forEach(h => { inventory[key][h] = ""; });
      }
      if (item.ingredients) inventory[key].ingredients = item.ingredients;
      const rKey = MEAL_RATING_KEY[item.rating];
      if (rKey) inventory[key][rKey] = addDateToList(inventory[key][rKey], item.date);
      const reKey = MEAL_REACTION_KEY[item.reaction];
      if (reKey) inventory[key][reKey] = addDateToList(inventory[key][reKey], item.date);
    });
    await dataStore.writeTable(TABLES.MEALS_INVENTORY, Object.values(inventory), MEAL_INVENTORY_HEADERS);
  }
};
