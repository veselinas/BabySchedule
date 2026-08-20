/* ============================================================
   layoutEditor.js
   The "+" modal for building a new schedule-layout: add blocks in any
   order, configure each, reorder, then Save (writes layout_DDMMYY_n.csv).
   ============================================================ */

window.openLayoutEditor = function openLayoutEditor(dataStore, onSaved) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>New schedule layout</h2>
        <button type="button" class="modal-close" title="Close">&#10005;</button>
      </div>
      <div class="modal-body">
        <button type="button" class="add-block-btn"><span class="plus-circle">&#10133;</span> Add block</button>
        <div class="block-type-picker" style="display:none"></div>
        <div class="layout-blocks-list"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary modal-cancel">Cancel</button>
        <button type="button" class="btn-primary modal-save">Save layout</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.querySelector(".modal-close").addEventListener("click", closeModal);
  overlay.querySelector(".modal-cancel").addEventListener("click", closeModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });

  const picker = overlay.querySelector(".block-type-picker");
  const addBtn = overlay.querySelector(".add-block-btn");
  const listEl = overlay.querySelector(".layout-blocks-list");

  const blockConfigs = []; // {type, name, info, uiRowEl}

  addBtn.addEventListener("click", () => {
    picker.style.display = picker.style.display === "none" ? "flex" : "none";
  });

  BlockRegistry.all().forEach(cls => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "block-type-option";
    btn.textContent = cls.label;
    btn.addEventListener("click", () => {
      picker.style.display = "none";
      addBlockRow(cls);
    });
    picker.appendChild(btn);
  });

  function addBlockRow(cls) {
    const entry = { type: cls.typeKey, name: cls.label, info: "" };
    const row = document.createElement("div");
    row.className = "layout-block-row";
    row.innerHTML = `
      <div class="layout-block-row-header">
        <span class="drag-handle">&#8942;&#8942;</span>
        <strong>${cls.label}</strong>
        <span class="row-controls">
          <button type="button" class="move-up" title="Move up">&#8593;</button>
          <button type="button" class="move-down" title="Move down">&#8595;</button>
          <button type="button" class="remove-block" title="Remove">&#10005;</button>
        </span>
      </div>
      <div class="layout-block-config"></div>
    `;
    const configContainer = row.querySelector(".layout-block-config");
    cls.renderConfigEditor(configContainer, (info, name) => {
      entry.info = info;
      entry.name = name || cls.label;
    });

    row.querySelector(".remove-block").addEventListener("click", () => {
      const idx = blockConfigs.indexOf(entry);
      if (idx >= 0) blockConfigs.splice(idx, 1);
      row.remove();
    });
    row.querySelector(".move-up").addEventListener("click", () => {
      const idx = blockConfigs.indexOf(entry);
      if (idx > 0) {
        [blockConfigs[idx - 1], blockConfigs[idx]] = [blockConfigs[idx], blockConfigs[idx - 1]];
        listEl.insertBefore(row, row.previousElementSibling);
      }
    });
    row.querySelector(".move-down").addEventListener("click", () => {
      const idx = blockConfigs.indexOf(entry);
      if (idx < blockConfigs.length - 1 && row.nextElementSibling) {
        [blockConfigs[idx + 1], blockConfigs[idx]] = [blockConfigs[idx], blockConfigs[idx + 1]];
        listEl.insertBefore(row.nextElementSibling, row);
      }
    });

    blockConfigs.push(entry);
    listEl.appendChild(row);
  }

  overlay.querySelector(".modal-save").addEventListener("click", async () => {
    if (!blockConfigs.length) { alert("Add at least one block first."); return; }
    const saveBtn = overlay.querySelector(".modal-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      const filename = await dataStore.saveNewLayout(blockConfigs);
      closeModal();
      onSaved(filename);
    } catch (e) {
      alert("Could not save layout: " + e.message);
      saveBtn.disabled = false;
      saveBtn.textContent = "Save layout";
    }
  });
};
