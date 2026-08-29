/* ============================================================
   summary.js
   Collapsible "Daily summary" section shown above the block cards.
   Nothing is calculated until the user clicks "Show summary" (it re-reads
   the CSV tables and rebuilds the two plots on demand each time).

   Assumes these standalone questionnaire/counter blocks MAY exist in the
   current layout: "Water", "Wet nappies", "Dehydration", "Dirty nappies",
   "Constipation" (all optional — a stat is skipped if its field isn't in
   the layout). "Milk" and sleep totals don't depend on those and are
   always shown.
   ============================================================ */

(function () {

  // ---------------------------------------------------------------- helpers
  function dateCodeToDate(code) {
    const dd = Number(code.slice(0, 2)), mm = Number(code.slice(2, 4)), yy = Number(code.slice(4, 6));
    return new Date(2000 + yy, mm - 1, dd);
  }
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  function timeToMinutes(t) {
    if (!t) return null;
    const parts = t.split(":");
    if (parts.length < 2) return null;
    return Number(parts[0]) * 60 + Number(parts[1]);
  }
  function fmtMinutes(mins) {
    if (mins === null || mins === undefined || isNaN(mins)) return "—";
    const sign = mins < 0 ? "-" : "";
    mins = Math.abs(Math.round(mins));
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${sign}${h}h ${m}m`;
  }
  function fmtDateLabel(d) {
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function rowsForDate(rows, dateCode) {
    return rows.filter(r => r.date === dateCode).sort((a, b) => Number(a.block_id) - Number(b.block_id));
  }
  function sleepMinutes(row) {
    const s = timeToMinutes(row.start_time), e = timeToMinutes(row.end_time);
    if (s === null || e === null) return 0;
    let mins = e - s;
    if (mins < 0) mins += 1440;
    return mins;
  }

  function layoutHasField(layoutRows, name) {
    return layoutRows.some(r => r.type === "questionnaire_counter" && (r.name || "").toLowerCase() === name.toLowerCase());
  }
  function getQCAnswer(qcRows, dateCode, name) {
    const row = qcRows.find(r => r.date === dateCode && (r.question || "").toLowerCase() === name.toLowerCase());
    return row ? row.answer : null;
  }

  const RATING_EMOJI = { "accepted": "😊", "neutral": "😐", "not accepted": "😞" };
  function reactionIcon(reaction) {
    if (!reaction || reaction === "no") return "";
    if (reaction === "ambiguous") return " 🟡❗";
    return " 🔴❗";
  }

  // ---------------------------------------------------------------- sleep stats (single date)
  function computeSleepStats(allSleepRows, dateCode) {
    const rows = rowsForDate(allSleepRows, dateCode);
    if (!rows.length) return null;

    const nightAwake = parseFloat(rows[0].awake_duration_minutes || 0) || 0;
    const totalRaw = rows.reduce((sum, r) => sum + sleepMinutes(r), 0);
    const totalSleep = totalRaw - nightAwake;
    const nightSleep = sleepMinutes(rows[0]) - nightAwake;

    const windows = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const gapStart = timeToMinutes(rows[i].end_time), gapEnd = timeToMinutes(rows[i + 1].start_time);
      if (gapStart === null || gapEnd === null) continue;
      let gap = gapEnd - gapStart; if (gap < 0) gap += 1440;
      const fromLabel = i === 0 ? "Night" : `Nap ${i}`;
      windows.push({ label: `${fromLabel} → Nap ${i + 1}`, minutes: gap });
    }
    const nextDateCode = DataStore.dateCode(addDays(dateCodeToDate(dateCode), 1));
    const nextDayRows = rowsForDate(allSleepRows, nextDateCode);
    const nextNight = nextDayRows.length ? nextDayRows[0] : null; // first sleep block of the next day = that day's "night", same convention as rows[0] above
    if (nextNight && nextNight.start_time) {
      const gapStart = timeToMinutes(rows[rows.length - 1].end_time);
      const gapEnd = timeToMinutes(nextNight.start_time);
      if (gapStart !== null && gapEnd !== null) {
        let gap = gapEnd - gapStart; if (gap < 0) gap += 1440;
        const fromLabel = rows.length === 1 ? "Night" : `Nap ${rows.length - 1}`;
        windows.push({ label: `${fromLabel} → Next night`, minutes: gap });
      }
    }
    const avgWindow = windows.length ? windows.reduce((s, w) => s + w.minutes, 0) / windows.length : null;
    return { totalSleep, nightSleep, windows, avgWindow };
  }

  // ---------------------------------------------------------------- hydration / food (single date)
  async function computeHydrationFood(dataStore, layoutRows, dateCode) {
    const { rows: qcRows } = await dataStore.readTable(TABLES.QANDC, ["date", "question", "type", "answer"]);
    const { rows: bottleRows } = await dataStore.readTable(TABLES.BOTTLES, BOTTLE_HEADERS);
    const { rows: sleepRows } = await dataStore.readTable(TABLES.SLEEP, SLEEP_HEADERS);
    const bottleMilk = bottleRows.filter(r => r.date === dateCode).reduce((s, r) => s + (parseFloat(r.quantity_taken) || 0), 0);
    const nightMilk = sleepRows.filter(r => r.date === dateCode).reduce((s, r) => s + (parseFloat(r.milk) || 0), 0);
    const milk = bottleMilk + nightMilk;
     
    const water = layoutHasField(layoutRows, "Water") ? (parseFloat(getQCAnswer(qcRows, dateCode, "Water")) || 0) : null;
    const wetNappies = layoutHasField(layoutRows, "Wet nappies") ? (parseFloat(getQCAnswer(qcRows, dateCode, "Wet nappies")) || 0) : null;
    const dehydration = layoutHasField(layoutRows, "Dehydration") ? (getQCAnswer(qcRows, dateCode, "Dehydration") || "no") : null;
    const dirtyNappies = layoutHasField(layoutRows, "Dirty nappies") ? (getQCAnswer(qcRows, dateCode, "Dirty nappies") || "no") : null;
    const constipation = layoutHasField(layoutRows, "Constipation") ? (getQCAnswer(qcRows, dateCode, "Constipation") || "no") : null;

    return { milk, water, wetNappies, dehydration, dirtyNappies, constipation };
  }

  async function getMealItemsForDate(dataStore, dateCode) {
    const { rows } = await dataStore.readTable("MealItems.csv", MEAL_ITEMS_HEADERS);
    return rows.filter(r => r.date === dateCode);
  }

  // ---------------------------------------------------------------- plots
  function buildSleepWeekSvg(allSleepRows, weekDates) {
    const width = 700, height = 300;
    const marginLeft = 46, marginRight = 10, marginTop = 10, marginBottom = 26;
    const plotW = width - marginLeft - marginRight;
    const plotH = height - marginTop - marginBottom;
    const colW = plotW / weekDates.length;

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="week-svg" xmlns="http://www.w3.org/2000/svg">`;

    for (let h = 0; h <= 24; h += 6) {
      const y = marginTop + (h / 24) * plotH;
      svg += `<line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" stroke="#e2ddcf" stroke-width="1" />`;
      svg += `<text x="${marginLeft - 6}" y="${y + 4}" font-size="10" text-anchor="end" fill="#6b7a71">${String(h).padStart(2, "0")}:00</text>`;
    }

    const dateIndex = {};
    weekDates.forEach((d, i) => {
      dateIndex[DataStore.dateCode(d)] = i;
      const x = marginLeft + i * colW;
      svg += `<text x="${x + colW / 2}" y="${height - 8}" font-size="10" text-anchor="middle" fill="#6b7a71">${fmtDateLabel(d)}</text>`;
    });

    weekDates.forEach(d => {
      const dc = DataStore.dateCode(d);
      rowsForDate(allSleepRows, dc).forEach(row => {
        const s = timeToMinutes(row.start_time), e = timeToMinutes(row.end_time);
        if (s === null || e === null) return;
        const color = row.type === "night" ? "#4f6f56" : "#7a93ac";
        const hasStar = row.type === "night" && (parseFloat(row.awake_duration_minutes) || 0) > 0;
        const segments = e < s
          ? [{ dc: DataStore.dateCode(addDays(d, -1)), start: s, end: 1440 }, { dc, start: 0, end: e }]
          : [{ dc, start: s, end: e }];

        segments.forEach(seg => {
          const colIdx = dateIndex[seg.dc];
          if (colIdx === undefined) return; // falls outside the visible 7 days — clipped
          const x = marginLeft + colIdx * colW + colW * 0.15;
          const w = colW * 0.7;
          const y = marginTop + (seg.start / 1440) * plotH;
          const h = Math.max(2, ((seg.end - seg.start) / 1440) * plotH);
          svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}" />`;
          if (hasStar) svg += `<text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2 + 4).toFixed(1)}" font-size="12" text-anchor="middle" fill="#fff">★</text>`;
        });
      });
    });

    svg += `</svg>`;
    return svg;
  }

  function buildHydrationWeekSvg(hydrationData) {
    const width = 700, height = 260;
    const marginLeft = 46, marginRight = 10, marginTop = 20, marginBottom = 40;
    const plotW = width - marginLeft - marginRight;
    const plotH = height - marginTop - marginBottom;
    const colW = plotW / hydrationData.length;
    const maxTotal = Math.max(50, ...hydrationData.map(d => (d.milk || 0) + (d.water || 0)));

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="week-svg" xmlns="http://www.w3.org/2000/svg">`;

    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxTotal * i / 4);
      const y = marginTop + plotH - (val / maxTotal) * plotH;
      svg += `<line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" stroke="#e2ddcf" stroke-width="1" />`;
      svg += `<text x="${marginLeft - 6}" y="${y + 3}" font-size="10" text-anchor="end" fill="#6b7a71">${val}</text>`;
    }

    hydrationData.forEach((d, i) => {
      const x = marginLeft + i * colW + colW * 0.2;
      const barW = colW * 0.6;
      const water = d.water || 0, milk = d.milk || 0, total = water + milk;
      const waterH = (water / maxTotal) * plotH, milkH = (milk / maxTotal) * plotH;
      const baseY = marginTop + plotH;

      if (water > 0) svg += `<rect x="${x.toFixed(1)}" y="${(baseY - waterH).toFixed(1)}" width="${barW.toFixed(1)}" height="${waterH.toFixed(1)}" fill="#7a93ac" />`;
      if (milk > 0) svg += `<rect x="${x.toFixed(1)}" y="${(baseY - waterH - milkH).toFixed(1)}" width="${barW.toFixed(1)}" height="${milkH.toFixed(1)}" fill="#e6a780" />`;
      if (total > 0) svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${(baseY - waterH - milkH - 6).toFixed(1)}" font-size="10" text-anchor="middle" fill="#33403a">${total}</text>`;

      svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${height - 22}" font-size="10" text-anchor="middle" fill="#6b7a71">${fmtDateLabel(d.date)}</text>`;

      const lowNappies = d.wetNappies !== null && d.wetNappies !== undefined && d.wetNappies < 5;
      const dehydrationFlag = d.dehydration === "yes";
      if (lowNappies || dehydrationFlag) {
        svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${height - 8}" font-size="13" text-anchor="middle" fill="#c56b5c">!</text>`;
      }
    });

    svg += `</svg>`;
    return svg;
  }

  // ---------------------------------------------------------------- content builder
  async function buildSummaryContent(dataStore, layoutFile, date) {
    const dateCode = DataStore.dateCode(date);
    const wrapper = document.createElement("div");
    wrapper.className = "summary-content";

    const { rows: layoutRows, isException } = await dataStore.getEffectiveLayoutRows(layoutFile, date);
    if (!layoutRows.length) {
      wrapper.innerHTML = `<p class="muted">No layout selected — pick one above first.</p>`;
      return wrapper;
    }

    const { rows: allSleepRows } = await dataStore.readTable(TABLES.SLEEP, SLEEP_HEADERS);
    const sleepStats = computeSleepStats(allSleepRows, dateCode);
    const hydrationFood = await computeHydrationFood(dataStore, layoutRows, dateCode);
    const mealItems = await getMealItemsForDate(dataStore, dateCode);

    if (isException) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = "This date uses one-off blocks — stats reflect that day's actual blocks.";
      wrapper.appendChild(note);
    }

    // Sleep
    const sleepSection = document.createElement("div");
    sleepSection.className = "summary-section";
    sleepSection.innerHTML = `<h3>Sleep</h3>`;
    if (!sleepStats) {
      sleepSection.innerHTML += `<p class="muted">No sleep logged for this date.</p>`;
    } else {
      sleepSection.innerHTML += `
        <dl class="summary-stat-list">
          <dt>Total sleep</dt><dd>${fmtMinutes(sleepStats.totalSleep)}</dd>
          <dt>Night sleep</dt><dd>${fmtMinutes(sleepStats.nightSleep)}</dd>
        </dl>`;
      if (sleepStats.windows.length) {
        const ww = document.createElement("div");
        ww.className = "summary-substat";
        ww.innerHTML = `<strong>Wake windows</strong>` +
          sleepStats.windows.map(w => `<div>${w.label}: ${fmtMinutes(w.minutes)}</div>`).join("") +
          `<div>Average: ${fmtMinutes(sleepStats.avgWindow)}</div>`;
        sleepSection.appendChild(ww);
      }
    }
    wrapper.appendChild(sleepSection);

    // Hydration
    const hydrationSection = document.createElement("div");
    hydrationSection.className = "summary-section";
    let hHtml = `<h3>Hydration</h3><dl class="summary-stat-list"><dt>Milk</dt><dd>${hydrationFood.milk} ml</dd>`;
    if (hydrationFood.water !== null) hHtml += `<dt>Water</dt><dd>${hydrationFood.water} ml</dd>`;
    if (hydrationFood.wetNappies !== null) hHtml += `<dt>Wet nappies</dt><dd>${hydrationFood.wetNappies}</dd>`;
    if (hydrationFood.dehydration !== null) hHtml += `<dt>Dehydration concern</dt><dd>${hydrationFood.dehydration}</dd>`;
    hHtml += `</dl>`;
    hydrationSection.innerHTML = hHtml;
    wrapper.appendChild(hydrationSection);

    // Food
    const foodSection = document.createElement("div");
    foodSection.className = "summary-section";
    foodSection.innerHTML = `<h3>Food</h3>`;
    if (mealItems.length) {
      const ul = document.createElement("ul");
      ul.className = "summary-meal-list";
      mealItems.forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${RATING_EMOJI[item.rating] || "•"} ${item.meal}${reactionIcon(item.reaction)}`;
        ul.appendChild(li);
      });
      foodSection.appendChild(ul);
    } else {
      foodSection.innerHTML += `<p class="muted">No meals logged for this date.</p>`;
    }
    let fHtml = "";
    if (hydrationFood.dirtyNappies !== null) fHtml += `<dt>Dirty nappies</dt><dd>${hydrationFood.dirtyNappies}</dd>`;
    if (hydrationFood.constipation !== null) fHtml += `<dt>Constipation</dt><dd>${hydrationFood.constipation}</dd>`;
    if (fHtml) {
      const fList = document.createElement("dl");
      fList.className = "summary-stat-list";
      fList.innerHTML = fHtml;
      foodSection.appendChild(fList);
    }
    wrapper.appendChild(foodSection);

    // Plots (last 7 days ending on the selected date)
    const weekDates = [];
    for (let i = 6; i >= 0; i--) weekDates.push(addDays(date, -i));

    const plotsSection = document.createElement("div");
    plotsSection.className = "summary-section";
    plotsSection.innerHTML = `<h3>Last 7 days</h3>`;

    const sleepPlot = document.createElement("div");
    sleepPlot.className = "summary-plot";
    sleepPlot.innerHTML = `<div class="summary-plot-title">Sleep <span class="muted">(sage = night, blue = nap, ★ = awake time logged)</span></div>` +
      buildSleepWeekSvg(allSleepRows, weekDates);
    plotsSection.appendChild(sleepPlot);

    const hydrationData = [];
    for (const d of weekDates) {
      const { rows: dayLayoutRows } = await dataStore.getEffectiveLayoutRows(layoutFile, d);
      hydrationData.push({ date: d, ...(await computeHydrationFood(dataStore, dayLayoutRows, DataStore.dateCode(d))) });
    }
    const hydrationPlot = document.createElement("div");
    hydrationPlot.className = "summary-plot";
    hydrationPlot.innerHTML = `<div class="summary-plot-title">Hydration <span class="muted">(peach = milk, blue = water, ! = &lt;5 nappies or dehydration flagged)</span></div>` +
      buildHydrationWeekSvg(hydrationData);
    plotsSection.appendChild(hydrationPlot);

    wrapper.appendChild(plotsSection);
    return wrapper;
  }

  // ---------------------------------------------------------------- public entry point
  window.renderSummarySection = function renderSummarySection(container, dataStore, layoutFile, date) {
    container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "block-card summary-card collapsed";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "block-card-header";
    header.innerHTML = `
      <span class="block-card-chevron">&#9656;</span>
      <span class="block-card-title">Daily summary</span>
    `;
    header.addEventListener("click", () => card.classList.toggle("collapsed"));
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "block-card-body";
    body.innerHTML = `<button type="button" class="btn-secondary summary-show-btn">Show summary</button>`;
    card.appendChild(body);

    function wireShowButton() {
      const btn = body.querySelector(".summary-show-btn");
      if (!btn) return;
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Calculating…";
        try {
          const content = await buildSummaryContent(dataStore, layoutFile, date);
          body.innerHTML = "";
          body.appendChild(content);
        } catch (err) {
          body.innerHTML = `<p class="muted">Could not build summary: ${err.message}</p><button type="button" class="btn-secondary summary-show-btn">Retry</button>`;
          wireShowButton();
        }
      });
    }
    wireShowButton();

    container.appendChild(card);
  };
})();
