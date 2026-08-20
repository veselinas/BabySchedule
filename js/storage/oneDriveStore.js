/* ============================================================
   oneDriveStore.js
   Store interface backed by Microsoft Graph / OneDrive.
   Same interface as LocalStore: init, listFiles, readFile, writeFile.
   All files live flat inside /App_BabySchedule (config.ONEDRIVE_FOLDER).
   ============================================================ */

window.OneDriveStore = class OneDriveStore {
  constructor(authService, config) {
    this.auth = authService;
    this.folder = config.ONEDRIVE_FOLDER;
    this.graphBase = "https://graph.microsoft.com/v1.0";
  }

  async init() {
    await this._ensureFolder();
    return true;
  }

  get accountLabel() {
    return this.auth.account ? this.auth.account.username : "Not signed in";
  }

  async _headers(extra) {
    const token = await this.auth.getToken();
    return Object.assign({ Authorization: `Bearer ${token}` }, extra || {});
  }

  async _ensureFolder() {
    const headers = await this._headers();
    const check = await fetch(
      `${this.graphBase}/me/drive/root:/${encodeURIComponent(this.folder)}`,
      { headers }
    );
    if (check.status === 404) {
      await fetch(`${this.graphBase}/me/drive/root/children`, {
        method: "POST",
        headers: await this._headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: this.folder,
          folder: {},
          "@microsoft.graph.conflictBehavior": "replace"
        })
      });
    }
  }

  async listFiles() {
    const headers = await this._headers();
    const res = await fetch(
      `${this.graphBase}/me/drive/root:/${encodeURIComponent(this.folder)}:/children?$select=name`,
      { headers }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.value || []).map(f => f.name);
  }

  async readFile(filename) {
    const headers = await this._headers();
    const path = `${this.folder}/${filename}`;
    const res = await fetch(
      `${this.graphBase}/me/drive/root:/${encodeURIComponent(path)}:/content`,
      { headers }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to read ${filename}: ${res.status}`);
    return await res.text();
  }

  async writeFile(filename, text) {
    const headers = await this._headers({ "Content-Type": "text/csv" });
    const path = `${this.folder}/${filename}`;
    const res = await fetch(
      `${this.graphBase}/me/drive/root:/${encodeURIComponent(path)}:/content`,
      { method: "PUT", headers, body: text }
    );
    if (!res.ok) throw new Error(`Failed to write ${filename}: ${res.status}`);
    return true;
  }
};
