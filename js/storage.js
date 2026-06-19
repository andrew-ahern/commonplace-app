/* ============================================================
   storage.js
   All reading and writing to browser local storage.
   Nothing else in the app touches localStorage directly.

   Keys:
     "entries"    — all saved entries, keyed by id
     "drafts"     — one draft per entry type, keyed by type
     "refs"       — all saved refs, keyed by id
     "ref_drafts" — one draft per ref type, keyed by type
     "tags"       — list of all tags used
     "settings"   — GitHub credentials and app config
   ============================================================ */


const storage = {

  // --- Entries ---

  saveEntry(entry) {
    const all = this.getAllEntries();
    all[entry.id] = entry;
    localStorage.setItem('entries', JSON.stringify(all));
  },

  getAllEntries() {
    return JSON.parse(localStorage.getItem('entries') || '{}');
  },

  getEntriesSortedByDate() {
    return Object.values(this.getAllEntries())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  deleteEntry(id) {
    const all = this.getAllEntries();
    if (!all[id] || !all[id].editable) return false;
    delete all[id];
    localStorage.setItem('entries', JSON.stringify(all));
    return true;
  },


  // --- Entry drafts ---

  saveDraft(type, data) {
    const drafts = this.getAllDrafts();
    drafts[type] = data;
    localStorage.setItem('drafts', JSON.stringify(drafts));
  },

  getDraft(type) {
    return this.getAllDrafts()[type] ?? null;
  },

  clearDraft(type) {
    const drafts = this.getAllDrafts();
    delete drafts[type];
    localStorage.setItem('drafts', JSON.stringify(drafts));
  },

  getAllDrafts() {
    return JSON.parse(localStorage.getItem('drafts') || '{}');
  },


  // --- Refs ---

  saveRef(ref) {
    const all = this.getAllRefs();
    all[ref.id] = ref;
    localStorage.setItem('refs', JSON.stringify(all));
  },

  getAllRefs() {
    return JSON.parse(localStorage.getItem('refs') || '{}');
  },

  getRefsSortedByDate() {
    return Object.values(this.getAllRefs())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  updateRef(ref) {
    if (!ref.editable) {
      console.warn('Cannot edit an exported ref:', ref.id);
      return false;
    }
    this.saveRef(ref);
    return true;
  },

  deleteRef(id) {
    const all = this.getAllRefs();
    if (!all[id]) return false;
    if (!all[id].editable) {
      console.warn('Cannot delete an exported ref:', id);
      return false;
    }
    delete all[id];
    localStorage.setItem('refs', JSON.stringify(all));
    return true;
  },


  // --- Ref drafts ---

  saveRefDraft(type, data) {
    const drafts = this.getAllRefDrafts();
    drafts[type] = data;
    localStorage.setItem('ref_drafts', JSON.stringify(drafts));
  },

  getRefDraft(type) {
    return this.getAllRefDrafts()[type] ?? null;
  },

  clearRefDraft(type) {
    const drafts = this.getAllRefDrafts();
    delete drafts[type];
    localStorage.setItem('ref_drafts', JSON.stringify(drafts));
  },

  getAllRefDrafts() {
    return JSON.parse(localStorage.getItem('ref_drafts') || '{}');
  },


  // --- Tags ---

  getTags() {
    return JSON.parse(localStorage.getItem('tags') || '[]');
  },

  addTag(tag) {
    const all = this.getTags();
    if (!all.includes(tag)) {
      all.push(tag);
      localStorage.setItem('tags', JSON.stringify(all));
    }
  },


  // --- Settings ---

  getSetting(key) {
    return this.getAllSettings()[key] ?? null;
  },

  setSetting(key, value) {
    const all = this.getAllSettings();
    all[key] = value;
    localStorage.setItem('settings', JSON.stringify(all));
  },

  getAllSettings() {
    return JSON.parse(localStorage.getItem('settings') || '{}');
  },

};
