/* ============================================================
   app.js
   Wires everything together: storage backend selection, sign-in,
   header controls (date, layout picker, +, save), and rendering the
   selected layout's blocks for the selected date.
   ============================================================ */

(async function () {
  const state = {
    store: null,
    dataStore: null,
    auth: null,
    currentDate: new Date(),
    currentLayoutFile: null,
    renderedBlocks: [] // { instance, layoutRow }
  };

  const els = {
    dateInput: document.getElementById("date-input"),
    saveBtn: document.getElementById("save-btn"),
    addLayoutBtn: document.getElementById("add-layout-btn"),
    layoutSelect: document.getElementById("layout-select"),
    blocksContainer: document.getElementById("blocks-container"),
    summaryContainer: document.getElementById("summary-container"),
    accountLabel: document.getElementById("account-label"),
    signInBtn: document.getElementById("sign-in-btn"),
    toast: document.getElementById("toast")
  };

  function toISODate(d) {
    const yyyy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  function fromISODate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function showToast(msg, isError) {
    els.toast.textContent = msg;
    els.toast.className = "toast show" + (isError ? " error" : "");
    setTimeout(() => { els.toast.className = "toast"; }, 2500);
  }

  // ---------------------------------------------------------------- init
  async function initStorage() {
    if (APP_CONFIG.USE_LOCAL_STORAGE_ONLY) {
      state.store = new LocalStore();
      await state.store.init();
      state.dataStore = new DataStore(state.store);
      els.accountLabel.textContent = state.store.accountLabel;
      els.signInBtn.style.display = "none";
    } else {
      state.auth = new AuthService(APP_CONFIG);
      await state.auth.init();
      if (!state.auth.isSignedIn()) {
        els.accountLabel.textContent = "Not signed in";
        els.signInBtn.style.display = "inline-block";
        els.signInBtn.addEventListener("click", async () => {
          try {
            await state.auth.signIn();
            await finishOneDriveInit();
            await refreshLayoutSelect(true);
          } catch (e) { showToast("Sign-in failed: " + e.message, true); }
        });
        return; // wait for sign-in
      }
      await finishOneDriveInit();
    }
  }

  async function finishOneDriveInit() {
    state.store = new OneDriveStore(state.auth, APP_CONFIG);
    await state.store.init();
    state.dataStore = new DataStore(state.store);
    els.accountLabel.textContent = state.store.accountLabel;
    els.signInBtn.style.display = "none";
  }

  // ---------------------------------------------------------------- layouts
  async function refreshLayoutSelect(selectLatest) {
    const files = await state.dataStore.listLayoutFiles();
    els.layoutSelect.innerHTML = "";
    if (!files.length) {
      const opt = document.createElement("option");
      opt.value = ""; opt.textContent = "No layouts yet — click + to create one";
      els.layoutSelect.appendChild(opt);
      state.currentLayoutFile = null;
      renderAll();
      return;
    }
    files.slice().reverse().forEach(f => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = describeLayoutFile(f);
      els.layoutSelect.appendChild(opt);
    });
    if (selectLatest || !state.currentLayoutFile) {
      state.currentLayoutFile = await state.dataStore.getLatestLayoutFilename();
    }
    els.layoutSelect.value = state.currentLayoutFile;
    renderAll();
  }

  function describeLayoutFile(filename) {
    const m = filename.match(/^layout_(\d{2})(\d{2})(\d{2})_(\d+)\.csv$/);
    if (!m) return filename;
    const [, dd, mm, yy, ver] = m;
    return `Layout ${dd}/${mm}/${yy} (v${ver})`;
  }

  // ---------------------------------------------------------------- rendering
    // ---------------------------------------------------------------- rendering
  let renderToken = 0;
  async function renderBlocks() {
    const myToken = ++renderToken;
    els.blocksContainer.innerHTML = "";
    state.renderedBlocks = [];
    if (!state.currentLayoutFile) {
      els.blocksContainer.innerHTML = `<p class="muted empty-state">No layout selected yet. Use the + button above to build one.</p>`;
      return;
    }
    const { rows } = await state.dataStore.readLayout(state.currentLayoutFile);
    if (myToken !== renderToken) return; // a newer render started meanwhile — abandon this one
    if (!rows.length) {
      els.blocksContainer.innerHTML = `<p class="muted empty-state">This layout has no blocks.</p>`;
      return;
    }
    for (const layoutRow of rows) {
      if (myToken !== renderToken) return;
      const cls = BlockRegistry.get(layoutRow.type);

      const card = document.createElement("div");
      card.className = "block-card";
      if (cls && cls.defaultCollapsed) card.classList.add("collapsed");

      const header = document.createElement("button");
      header.type = "button";
      header.className = "block-card-header";
      header.innerHTML = `
        <span class="block-card-chevron">&#9656;</span>
        <span class="block-card-title"></span>
        <span class="block-card-time muted"></span>
      `;
      header.querySelector(".block-card-title").textContent = layoutRow.name || (cls ? cls.label : layoutRow.type);
      const timeEl = header.querySelector(".block-card-time");
      header.addEventListener("click", () => card.classList.toggle("collapsed"));
      card.appendChild(header);

      const body = document.createElement("div");
      body.className = "block-card-body";
      card.appendChild(body);

      if (!cls) {
        body.innerHTML = `<p class="muted">Unknown block type: ${layoutRow.type}</p>`;
        els.blocksContainer.appendChild(card);
        continue;
      }
      const instance = new cls(layoutRow);
      await instance.renderInstance(body, {
        date: state.currentDate,
        dataStore: state.dataStore,
        layoutRow,
        setTitleTime: text => { timeEl.textContent = text || ""; }
      });
      if (myToken !== renderToken) return; // abandon: a newer render superseded this one
      els.blocksContainer.appendChild(card);
      state.renderedBlocks.push({ instance, layoutRow });
    }
  }

  // ---------------------------------------------------------------- events
    // ---------------------------------------------------------------- summary + blocks
  function renderAll() {
    renderSummarySection(els.summaryContainer, state.dataStore, state.currentLayoutFile, state.currentDate);
    return renderBlocks();
  }

  // ---------------------------------------------------------------- events
  els.dateInput.value = toISODate(state.currentDate);
  els.dateInput.addEventListener("change", () => {
    state.currentDate = fromISODate(els.dateInput.value);
    state.dataStore.clearCache();
    renderAll();
  });

  els.layoutSelect.addEventListener("change", () => {
    state.currentLayoutFile = els.layoutSelect.value;
    renderAll();
  });

  els.addLayoutBtn.addEventListener("click", () => {
    openLayoutEditor(state.dataStore, async (filename) => {
      state.currentLayoutFile = filename;
      await refreshLayoutSelect(false);
      els.layoutSelect.value = filename;
      showToast("Layout created");
    });
  });

  els.saveBtn.addEventListener("click", async () => {
    if (!state.renderedBlocks.length) return;
    els.saveBtn.disabled = true;
    const originalText = els.saveBtn.textContent;
    els.saveBtn.textContent = "Saving…";
    try {
      for (const { instance, layoutRow } of state.renderedBlocks) {
        await instance.save({ date: state.currentDate, dataStore: state.dataStore, layoutRow });
      }
      showToast("Saved");
    } catch (e) {
      showToast("Save failed: " + e.message, true);
    } finally {
      els.saveBtn.disabled = false;
      els.saveBtn.textContent = originalText;
    }
  });

  // ---------------------------------------------------------------- boot
  await initStorage();
  if (state.dataStore) await refreshLayoutSelect(true);
})();
