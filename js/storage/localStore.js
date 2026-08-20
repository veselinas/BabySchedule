/* ============================================================
   localStore.js
   Store interface backed by the browser's localStorage.
   Every "file" is a key: babytracker::<filename>
   Interface (all async to mirror OneDriveStore):
     init()
     listFiles()                -> string[] filenames
     readFile(filename)         -> string | null
     writeFile(filename, text)  -> void
   ============================================================ */

window.LocalStore = class LocalStore {
  constructor() {
    this.prefix = "babytracker::";
  }

  async init() { return true; }

  async listFiles() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        out.push(key.slice(this.prefix.length));
      }
    }
    return out;
  }

  async readFile(filename) {
    const val = localStorage.getItem(this.prefix + filename);
    return val === null ? null : val;
  }

  async writeFile(filename, text) {
    localStorage.setItem(this.prefix + filename, text);
    return true;
  }

  get accountLabel() { return "Local (offline) storage"; }
};
