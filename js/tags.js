/* ============================================================
   tags.js
   Manages the tag list used for autocomplete suggestions.
   Tags are stored in local storage under "tags".
   New tags are added automatically when entries are saved.
   ============================================================ */


const tags = {

  // Return all tags as a sorted array
  getAll() {
    return storage.getTags().sort();
  },

  // Add a new tag if not already present (normalised to lowercase)
  add(tag) {
    const clean = tag.trim().toLowerCase();
    if (clean) storage.addTag(clean);
  },

  // Add all tags from a comma-separated string
  addFromString(str) {
    str.split(',').forEach(tag => this.add(tag));
  },

  // Return tags matching a partial input, ranked by match quality:
  // 1. Start of string  2. Start of a word  3. Substring
  getSuggestions(input) {
    const query = input.trim().toLowerCase();
    if (!query) return [];

    const all = this.getAll();

    const startOf    = all.filter(t => t.startsWith(query));
    const startWord  = all.filter(t => !t.startsWith(query) && t.split(/\W/).some(w => w.startsWith(query)));
    const substring  = all.filter(t => !startOf.includes(t) && !startWord.includes(t) && t.includes(query));

    return [...startOf, ...startWord, ...substring];
  },

};
