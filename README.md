# Baby Schedule Tracker

A small static web app for logging a baby's daily schedule (sleep, bottles,
meals, diary, plus free-form counters/questionnaires) into CSV files on
OneDrive. Works on laptop and iPhone (it's just a web page — add it to your
iPhone home screen from Safari for an app-like feel).

It currently runs in **local (offline) mode** by default — data is saved in
your browser's storage, nothing leaves your device — so you can try the whole
app immediately, with no setup. Switch to real OneDrive sync whenever you're
ready (steps below).

## Try it right now

Open `index.html` in a browser (double-click it, or run a tiny local server —
see "Hosting" below). Click the **+** button to build your first layout,
add some blocks, save the layout, then fill in today's schedule and hit
**Save**.

## Switching to real OneDrive sync

### 1. Register an app in Azure Portal
1. Go to [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name it anything (e.g. "Baby Schedule Tracker").
3. Under **Supported account types**, choose **Personal Microsoft accounts only** (this is what your OneDrive login uses).
4. Under **Redirect URI**, choose platform **Single-page application (SPA)** and enter the exact URL you'll host this app at, e.g. `https://yourname.github.io/baby-tracker/`. You can add `http://localhost:5500/` too, for local testing.
5. Click **Register**, then copy the **Application (client) ID** from the overview page.
6. Under **API permissions**, add **Microsoft Graph → Delegated → Files.ReadWrite** and **User.Read** (User.Read is usually there by default). Admin consent isn't needed for personal Microsoft accounts using delegated permissions like these.

### 2. Configure the app
Open `js/config.js` and set:
```js
CLIENT_ID: "paste-your-client-id-here",
USE_LOCAL_STORAGE_ONLY: false,
```

### 3. Host it somewhere with a stable URL
Azure's SPA sign-in flow requires a real `https://` URL (or `http://localhost`) —
it won't work opened directly as a `file://` path. Easiest free options:
- **GitHub Pages**: push this folder to a repo, enable Pages on the `main` branch.
- **Azure Static Web Apps** (free tier): natural fit since you're already in Azure Portal.
- Any static host (Netlify, Vercel, etc.) works too.

Make sure the redirect URI you registered in step 1 matches the hosted URL exactly.

### 4. Sign in
Open the hosted page, click **Sign in with Microsoft**, and approve access.
The app will create a folder called `App_BabySchedule` in your OneDrive root
the first time it runs, and all CSVs live there.

## How the data is organised

All files live in `/App_BabySchedule` in OneDrive:

| File | Contents |
|---|---|
| `layout_DDMMYY_n.csv` | One per saved layout: `order, type, name, info` |
| `QuestionnairesAndCounters.csv` | Standalone question/counter fields: `date, question, type, answer` |
| `Sleep.csv` | One row per sleep entry per day |
| `Bottles.csv` | One row per bottle feed per day |
| `Meals.csv` | One row per meal per day (header-level answers) |
| `MealItems.csv` | One row per food item logged within a meal (see note below) |
| `MealsInventory.csv` | Aggregated per-food rating/reaction history, derived from `MealItems.csv` |
| `Diary.csv` | `date, block_id, type, note` — type is milestone / memory / mood / notes |

**Note on `block_id`**: the spec's example layout includes multiple Sleep,
Bottle, and Meal blocks in a single day's layout (e.g. three separate Sleep
entries). To keep each of those distinct in the CSV rather than overwriting
each other, every "main" block's row is keyed by `date` **and** `block_id`
(the block's position number in its layout), not just `date`.

**Note on `MealItems.csv`**: the original spec describes only `Meals.csv`
(header-level) and `MealsInventory.csv` (aggregated food history). That
combination can't be edited after the fact — once a food's rating is folded
into the aggregate list, there's no way to reopen "what did I log for lunch
on the 20th" and change it. `MealItems.csv` keeps that per-meal detail so
edits are possible; `MealsInventory.csv` is then always *rebuilt* from it on
every save, so it stays exactly the shape described in the spec (meal,
ingredients, and comma-separated date-lists per rating/reaction).

**Other small assumptions**, all easy to change in code:
- Bottle "quantity taken/offered" counters default to a 10ml increment (`js/blocks/bottle.js`).
- Sleep duration is computed as `end − start`, wrapping past midnight for night sleep.

## Extending the app

The block system is a small plugin architecture (`js/blocks/`):

- `base.js` defines the contract every block type follows: a static config
  editor (used in the "add block" layout builder) and two instance methods,
  `renderInstance()` and `save()`.
- To add a **new block type**, create a class extending `BaseBlock` and
  register it in `js/blocks/index.js`. It will automatically show up in the
  "+ Add block" picker and render/save wherever it's used in a layout.
- To **extend an existing block** (e.g. add a field to Sleep), edit the
  `*_QC_FIELDS` array and `*_HEADERS` list at the top of the relevant file
  (`sleep.js`, `bottle.js`, `meal.js`) — the rendering and save logic pick
  new fields up automatically.
- Counters and questionnaires are a shared, reusable UI component
  (`js/blocks/fieldWidgets.js`), used both as standalone layout blocks
  (`questionnaireCounter.js`) and embedded inside the main blocks — exactly
  as required.
- Charts: nowhere yet, by design. When you're ready to add them, `Sleep.csv`
  / `Bottles.csv` / `Meals.csv` / `QuestionnairesAndCounters.csv` already
  have everything needed to plot against; a new "chart" block type would
  fit the same plugin system.

## Project structure

```
index.html
css/styles.css
js/
  config.js            global settings & controlled vocabularies (moods, ratings, etc.)
  csv.js               CSV parse/serialize helpers
  dataStore.js          layout + table read/write/upsert logic
  auth.js               Microsoft sign-in (MSAL)
  storage/
    localStore.js        offline/demo storage backend
    oneDriveStore.js      OneDrive (Microsoft Graph) storage backend
  blocks/
    base.js               block plugin contract + registry
    fieldWidgets.js        shared checkbox/rating/counter UI
    questionnaireCounter.js
    sleep.js
    bottle.js
    meal.js
    diary.js
    index.js               registers all block types
  layoutEditor.js        "+ new layout" modal
  app.js                 wires it all together
```
