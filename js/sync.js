/* ============================================================
   sync.js
   Handles all communication with the GitHub data repo.
   Uses the GitHub Contents API to push and pull files.

   Export: pushes new local entries and refs to GitHub,
           merges tags, marks everything as editable:false.
   Import: pulls new entries and refs from GitHub into
           local storage, merges tags.

   Both operations are append-only — nothing is overwritten
   or deleted at the destination.

   Entry IDs:  plain Unix timestamps e.g. "1749123456789"
   Ref IDs:    prefixed e.g. "ref_1749123456789"
   Files:      entries/1749123456789.md
               refs/ref_1749123456789.md
   ============================================================ */


const sync = {

  // --- GitHub API helpers ---

  getConfig() {
    const repo  = storage.getSetting('gh_repo');
    const token = storage.getSetting('gh_token');
    return (repo && token) ? { repo, token } : null;
  },

  headers() {
    const cfg = this.getConfig();
    return {
      'Authorization': `Bearer ${cfg.token}`,
      'Accept':        'application/vnd.github.v3+json',
      'Content-Type':  'application/json',
    };
  },

  async ghGet(path) {
    const cfg = this.getConfig();
    if (!cfg) throw new Error('No GitHub config');
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}?t=${Date.now()}`;
    const res = await fetch(url, { headers: this.headers(), cache: 'no-store' });
    if (res.status === 401) throw new Error('Invalid token — reload your config file');
    if (res.status === 403) throw new Error('Access denied — check token permissions');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub error: ${res.status}`);
    return res.json();
  },

  async ghGetText(path) {
    const data = await this.ghGet(path);
    if (!data) return { text: null, sha: null };
    const text = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
    return { text, sha: data.sha };
  },

  async ghGetJSON(path) {
    const { text, sha } = await this.ghGetText(path);
    if (!text || !text.trim()) return { content: null, sha };
    return { content: JSON.parse(text), sha };
  },

  async ghList(folder) {
    const data = await this.ghGet(folder);
    if (!Array.isArray(data)) return [];
    return data;
  },

  async ghPut(path, text, sha) {
    const cfg     = this.getConfig();
    const encoded = btoa(unescape(encodeURIComponent(text)));
    const body    = { message: `commonplace: ${path}`, content: encoded };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${path}`, {
      method:  'PUT',
      headers: this.headers(),
      body:    JSON.stringify(body),
    });

    if (res.status === 401) throw new Error('Invalid token — reload your config file');
    if (res.status === 403) throw new Error('Access denied — check token permissions');
    if (res.status === 404) throw new Error('Data repo not found — check your config file');

    if (res.status === 409) {
      const current = await this.ghGet(path);
      if (!current) throw new Error('Conflict: file disappeared during export');
      const retryBody = { ...body, sha: current.sha };
      const retry = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${path}`, {
        method:  'PUT',
        headers: this.headers(),
        body:    JSON.stringify(retryBody),
      });
      if (!retry.ok) throw new Error(`GitHub write error after retry: ${retry.status}`);
      return retry.json();
    }

    if (!res.ok) throw new Error(`GitHub write error: ${res.status}`);
    return res.json();
  },


  // --- Formatting ---

  // Convert an entry or ref object to YAML frontmatter markdown
  // Handles nested objects (e.g. inline ref on an entry)
  formatAsMarkdown(record) {
    const lines = this.objectToYaml(record, '');
    return `---\n${lines.join('\n')}\n---\n`;
  },

  objectToYaml(obj, indent) {
    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value)) {
        lines.push(`${indent}${key}: [${value.join(', ')}]`);
      } else if (typeof value === 'object') {
        // Nested object (e.g. inline ref) — use YAML block style
        lines.push(`${indent}${key}:`);
        lines.push(...this.objectToYaml(value, indent + '  '));
      } else if (typeof value === 'string' && value.includes('\n')) {
        lines.push(`${indent}${key}: |`);
        value.split('\n').forEach(l => lines.push(`${indent}  ${l}`));
      } else {
        lines.push(`${indent}${key}: ${value}`);
      }
    }
    return lines;
  },

  // Parse a YAML frontmatter markdown file back into an object
  parseMarkdown(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    return this.parseYaml(match[1].split('\n'), 0).obj;
  },

  // Parse YAML lines recursively, handling nested objects and block scalars
  parseYaml(lines, startIndex) {
    const obj = {};
    let i = startIndex;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      const indent = line.match(/^(\s*)/)[1].length;
      if (indent < (startIndex > 0 ? 2 : 0)) break;

      const colon = line.indexOf(':');
      if (colon === -1) { i++; continue; }

      const key   = line.slice(indent, colon).trim();
      const value = line.slice(colon + 1).trim();

      if (value === '|') {
        // Block scalar
        const blockLines = [];
        i++;
        while (i < lines.length && lines[i].startsWith('  ')) {
          blockLines.push(lines[i].slice(2));
          i++;
        }
        obj[key] = blockLines.join('\n');
        continue;
      }

      if (value === '') {
        // Nested object
        const result = this.parseYaml(lines, i + 1);
        obj[key] = result.obj;
        i = result.nextIndex;
        continue;
      }

      if (value.startsWith('[') && value.endsWith(']')) {
        obj[key] = value.slice(1, -1).split(',').map(v => v.trim()).filter(Boolean);
      } else if (value === 'true')  { obj[key] = true;
      } else if (value === 'false') { obj[key] = false;
      } else { obj[key] = value; }

      i++;
    }
    return { obj, nextIndex: i };
  },


  // --- Export ---

  async exportToGitHub() {
    if (!navigator.onLine) { showToast('No internet connection'); return; }
    const cfg = this.getConfig();
    if (!cfg) { showToast('Load GitHub config first'); return; }
    showToast('Exporting…', 30000);

    try {
      const [ghEntryFiles, ghRefFiles] = await Promise.all([
        this.ghList('entries'),
        this.ghList('refs'),
      ]);

      // Compare by filename (without .md extension)
      const ghEntryIds = new Set(ghEntryFiles.map(f => f.name.replace('.md', '')));
      const ghRefIds   = new Set(ghRefFiles.map(f => f.name.replace('.md', '')));

      const allEntries = Object.values(storage.getAllEntries());
      const allRefs    = Object.values(storage.getAllRefs());
      const newEntries = allEntries.filter(e => !ghEntryIds.has(e.id));
      const newRefs    = allRefs.filter(r => !ghRefIds.has(r.id));

      for (const entry of newEntries) {
        await this.ghPut(`entries/${entry.id}.md`, this.formatAsMarkdown(entry), null);
        storage.saveEntry({ ...entry, editable: false });
      }

      for (const ref of newRefs) {
        await this.ghPut(`refs/${ref.id}.md`, this.formatAsMarkdown(ref), null);
        storage.saveRef({ ...ref, editable: false });
      }

      // Merge tags — append only
      const { content: ghTags, sha: tagsSha } = await this.ghGetJSON('tags.json');
      const localTags  = storage.getTags();
      const mergedTags = [...new Set([...(ghTags || []), ...localTags])].sort();
      await this.ghPut('tags.json', JSON.stringify(mergedTags, null, 2), tagsSha);

      storage.setSetting('gh_last_export', new Date().toISOString());

      const parts = [];
      if (newEntries.length) parts.push(`${newEntries.length} ${newEntries.length === 1 ? 'entry' : 'entries'}`);
      if (newRefs.length)    parts.push(`${newRefs.length} ${newRefs.length === 1 ? 'ref' : 'refs'}`);
      showToast(parts.length ? `Exported ${parts.join(', ')} ✓` : 'Nothing to export');

    } catch (err) {
      showToast(`Export failed: ${err.message}`);
      console.error(err);
    }
  },


  // --- Import ---

  async importFromGitHub() {
    if (!navigator.onLine) { showToast('No internet connection'); return; }
    const cfg = this.getConfig();
    if (!cfg) { showToast('Load GitHub config first'); return; }
    showToast('Importing…', 30000);

    try {
      const localEntryIds = new Set(Object.keys(storage.getAllEntries()));
      const localRefIds   = new Set(Object.keys(storage.getAllRefs()));

      const [ghEntryFiles, ghRefFiles] = await Promise.all([
        this.ghList('entries'),
        this.ghList('refs'),
      ]);

      const newEntryFiles = ghEntryFiles.filter(f => !localEntryIds.has(f.name.replace('.md', '')));
      let importedEntries = 0;
      for (const file of newEntryFiles) {
        const { text } = await this.ghGetText(file.path);
        if (!text) continue;
        const entry = this.parseMarkdown(text);
        if (entry?.id) {
          storage.saveEntry({ ...entry, editable: false });
          importedEntries++;
        }
      }

      const newRefFiles = ghRefFiles.filter(f => !localRefIds.has(f.name.replace('.md', '')));
      let importedRefs = 0;
      for (const file of newRefFiles) {
        const { text } = await this.ghGetText(file.path);
        if (!text) continue;
        const ref = this.parseMarkdown(text);
        if (ref?.id) {
          storage.saveRef({ ...ref, editable: false });
          importedRefs++;
        }
      }

      const { content: ghTags } = await this.ghGetJSON('tags.json');
      if (ghTags) ghTags.forEach(tag => storage.addTag(tag));

      storage.setSetting('gh_last_import', new Date().toISOString());

      const parts = [];
      if (importedEntries) parts.push(`${importedEntries} ${importedEntries === 1 ? 'entry' : 'entries'}`);
      if (importedRefs)    parts.push(`${importedRefs} ${importedRefs === 1 ? 'ref' : 'refs'}`);
      showToast(parts.length ? `Imported ${parts.join(', ')} ✓` : 'Nothing to import');

    } catch (err) {
      showToast(`Import failed: ${err.message}`);
      console.error(err);
    }
  },

};
