/* ============================================================
   ui.settings.js
   Handles all interactions on the Settings screen.
   Add reference and Browse references open in a centred modal
   over the blurred settings screen.
   ============================================================ */


const uiSettings = {

  refTypes: Object.keys(SCHEMAS.ref_types),
  activeRefType: 'novel',

  // Types that have a secondary ref ("Published in") field
  primaryRefTypes: ['novel', 'novella', 'short_story', 'poem', 'play', 'essay', 'speech'],

  // Allowed types for secondary refs
  secondaryRefTypes: ['book', 'other'],


  // --- Initialisation ---

  init() {
    this.renderMain();
    this.registerModalHandlers();
  },


  // --- Modal helpers ---

  registerModalHandlers() {
    document.getElementById('modal-overlay').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('ref-sheet-close').addEventListener('click', () => this.closeRefSheet());
    document.getElementById('ref-sheet-overlay').addEventListener('click', () => this.closeRefSheet());
  },

  openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('settings-modal').style.display = 'block';
  },

  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('settings-modal').style.display = 'none';
    this.closeRefSheet(); // also close ref sheet if open
  },


  // --- Main settings view ---

  renderMain() {
    const screen = document.getElementById('screen-settings');
    screen.innerHTML = `
      <div class="screen-header"><h1>Settings</h1></div>

      <h3>GitHub sync</h3>
      <div class="card" style="margin-bottom:0.75rem;">
        <div class="card-row">
          <div>
            <div style="font-weight:500;">Config</div>
            <div style="font-size:13px; color:var(--muted);" id="config-status">${this.getConfigStatus()}</div>
          </div>
          <label class="btn" style="cursor:pointer; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;">
            Load
            <input type="file" accept=".txt" id="config-file-input" style="display:none;">
          </label>
        </div>
        <div class="card-row">
          <div>
            <div style="font-weight:500;">Export</div>
            <div style="font-size:13px; color:var(--muted);" id="export-status">${this.getExportStatus()}</div>
          </div>
          <button type="button" class="btn" id="export-btn" style="flex-shrink:0;">Export</button>
        </div>
        <div class="card-row">
          <div style="font-weight:500;">Import</div>
          <button type="button" class="btn" id="import-btn" style="flex-shrink:0;">Import</button>
        </div>
      </div>

      <h3>References</h3>
      <div class="card">
        <button type="button" class="settings-card-btn" id="btn-add-ref">
          Add new reference <span class="chevron">›</span>
        </button>
        <button type="button" class="settings-card-btn" id="btn-browse-refs" style="border-top:1px solid var(--border);">
          Browse references <span class="chevron">›</span>
        </button>
      </div>

      <h3>Data</h3>
      <div class="card">
        <div class="card-row">
          <div>
            <div style="font-weight:500;">Clear all data on this device</div>
            <div style="font-size:13px; color:var(--muted);">Permanently deletes all local entries, references and settings</div>
          </div>
          <button type="button" class="btn" id="btn-clear-data" style="color:var(--danger); border-color:var(--danger); flex-shrink:0;">Clear</button>
        </div>
      </div>
    `;

    document.getElementById('config-file-input').addEventListener('change', e => this.loadConfig(e));
    document.getElementById('export-btn').addEventListener('click', async () => {
      await sync.exportToGitHub();
      document.getElementById('export-status').textContent = this.getExportStatus();
    });
    document.getElementById('import-btn').addEventListener('click', async () => {
      await sync.importFromGitHub();
    });
    document.getElementById('btn-add-ref').addEventListener('click', () => this.openAddRef());
    document.getElementById('btn-browse-refs').addEventListener('click', () => this.openBrowseRefs());
    document.getElementById('btn-clear-data').addEventListener('click', () => {
      if (confirm('This will permanently delete all local entries, references, tags and settings.\n\nThis cannot be undone. Are you sure?')) {
        localStorage.clear();
        location.reload();
      }
    });
  },


  // --- Config loading ---

  loadConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const lines = e.target.result.split('\n');
        let repo = '', token = '';
        lines.forEach(line => {
          const [key, ...rest] = line.split(':');
          const val = rest.join(':').trim();
          if (key.trim() === 'repo')  repo  = val;
          if (key.trim() === 'token') token = val;
        });
        if (!repo || !token) { showToast('Invalid config file'); return; }
        storage.setSetting('gh_repo',  repo);
        storage.setSetting('gh_token', token);
        document.getElementById('config-status').textContent = this.getConfigStatus();
        showToast('Config loaded ✓');
      } catch (err) {
        showToast('Error reading config: ' + err.message);
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  },


  // --- Status helpers ---

  getConfigStatus() {
    const repo = storage.getSetting('gh_repo');
    return repo ? `Loaded (${repo})` : 'Not loaded';
  },

  getExportStatus() {
    const last     = storage.getSetting('gh_last_export');
    const unsynced = Object.values(storage.getAllEntries()).filter(e => !!e.editable).length
                   + Object.values(storage.getAllRefs()).filter(r => !!r.editable).length;
    if (last) {
      const d = new Date(last);
      const dateStr = d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      return `Last: ${dateStr} · ${unsynced} unsynced`;
    }
    return unsynced ? `${unsynced} unsynced` : 'Never exported';
  },


  // --- Add new reference (modal) ---

  openAddRef() {
    // Build form HTML for all ref types
    const typeButtons = this.refTypes.map(type => `
      <button type="button" class="type-btn ${type === this.activeRefType ? 'active' : ''}" data-type="${type}">
        ${SCHEMAS.ref_types[type].label}<span class="draft-dot"></span>
      </button>
    `).join('');

    const forms = this.refTypes.map(type => {
      const fields = Object.keys(SCHEMAS.ref_types[type].fields).map(field => `
        <div class="field">
          <label>${field}</label>
          <input type="text" name="${field}">
        </div>
      `).join('');
      return `
        <form id="ref-form-${type}" class="entry-form">
          <div class="card form-card">${fields}</div>
          <button type="button" class="save-btn" style="margin-top:0.75rem;">Save</button>
          <p class="draft-indicator" id="ref-draft-${type}"></p>
        </form>
      `;
    }).join('');

    this.openModal('New Reference', `
      <div id="ref-type-buttons" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:1rem;">${typeButtons}</div>
      <div id="ref-forms">${forms}</div>
    `);

    // Show active form
    this.switchRefType(this.activeRefType);

    // Restore drafts and indicators
    this.refTypes.forEach(type => {
      const draft = storage.getRefDraft(type);
      if (draft) this.fillRefForm(type, draft);
      this.updateRefDraftIndicator(type);
    });

    // Type buttons
    document.querySelectorAll('#ref-type-buttons .type-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchRefType(btn.dataset.type));
    });

    // Form handlers
    this.refTypes.forEach(type => {
      const form = document.getElementById(`ref-form-${type}`);
      if (!form) return;
      form.addEventListener('input', () => {
        this.saveRefDraft(type);
        this.updateRefDraftIndicator(type);
      });
      form.querySelector('.save-btn').addEventListener('click', () => this.saveRef(type));
      const indicator = document.getElementById(`ref-draft-${type}`);
      if (indicator) {
        indicator.addEventListener('click', e => {
          if (e.target.tagName === 'A') this.clearRefDraft(type);
        });
      }
    });
  },

  // Secondary ref state per primary ref type
  sourceState: {},

  switchRefType(type) {
    this.activeRefType = type;
    document.querySelectorAll('#ref-type-buttons .type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    document.querySelectorAll('#ref-forms .entry-form').forEach(form => {
      form.classList.toggle('active', form.id === `ref-form-${type}`);
    });

    // Register "Published in" handlers if this is a primary ref type
    if (this.primaryRefTypes.includes(type) && !this.sourceState[type]) {
      this.sourceState[type] = { manual: false, selectedId: null };
      this.registerPublishedInHandlers(type);
    }
  },

  registerPublishedInHandlers(type) {
    const state    = this.sourceState[type];
    const toggle   = document.getElementById(`${type}-source-toggle`);
    const saved    = document.getElementById(`${type}-source-saved`);
    const manual   = document.getElementById(`${type}-source-manual`);
    const search   = document.getElementById(`${type}-source-search`);
    const dropdown = document.getElementById(`${type}-source-dropdown`);

    if (!toggle) return;

    // Toggle switch
    toggle.addEventListener('click', () => {
      state.manual = !state.manual;
      toggle.classList.toggle('on', state.manual);
      saved.style.display  = state.manual ? 'none'  : 'block';
      manual.style.display = state.manual ? 'block' : 'none';
      if (state.manual) this.buildSourceManualFields(type);
    });

    // Search input
    search.addEventListener('focus', () => {
      this.renderSourceDropdown(type, search.value);
      dropdown.style.display = 'block';
    });

    search.addEventListener('input', () => {
      state.selectedId = null;
      document.querySelector(`#ref-form-${type} [name="source_id"]`).value = '';
      this.renderSourceDropdown(type, search.value);
      dropdown.style.display = 'block';
    });

    document.addEventListener('click', e => {
      const field = document.getElementById(`${type}-published-in-field`);
      if (field && !field.contains(e.target)) dropdown.style.display = 'none';
    });

    // Secondary ref type select
    const typeSelect = document.getElementById(`${type}-source-type-select`);
    if (typeSelect) {
      typeSelect.addEventListener('change', () => this.buildSourceManualFields(type));
    }
  },

  // Render dropdown for secondary ref search (book and other only)
  renderSourceDropdown(type, query) {
    const dropdown = document.getElementById(`${type}-source-dropdown`);
    const allRefs  = Object.values(storage.getAllRefs())
      .filter(r => this.secondaryRefTypes.includes(r.type));

    const ranked = allRefs.map(ref => ({
      ref,
      label: refs.getLabel(ref),
      score: this.matchScore(refs.getLabel(ref), query),
    })).filter(({ score }) => score > 0 || !query)
       .sort((a, b) => b.score - a.score);

    const html = ranked.map(({ ref, label }) =>
      `<div class="ref-option" data-id="${ref.id}"
            data-label="${label.replace(/"/g, '&quot;')}">${this.escapeHtml(label)}</div>`
    ).join('');

    dropdown.innerHTML = html || '<div class="ref-no-results">No references found</div>';

    dropdown.querySelectorAll('.ref-option').forEach(option => {
      option.addEventListener('click', () => {
        this.sourceState[type].selectedId = option.dataset.id;
        document.getElementById(`${type}-source-search`).value = option.dataset.label;
        document.querySelector(`#ref-form-${type} [name="source_id"]`).value = option.dataset.id;
        dropdown.style.display = 'none';
      });
    });
  },

  // Build manual fields for selected secondary ref type
  buildSourceManualFields(type) {
    const typeSelect = document.getElementById(`${type}-source-type-select`);
    const refType    = typeSelect?.value || 'book';
    const schema     = SCHEMAS.ref_types[refType];
    const container  = document.getElementById(`${type}-source-manual-fields`);
    if (!container) return;

    container.innerHTML = Object.keys(schema.fields).map(field => `
      <div class="field" style="margin-top:6px;">
        <label style="font-size:12px; color:var(--muted);">${field}</label>
        <input type="text" class="ref-manual-input" name="source_manual_${field}"
               style="margin-top:2px;">
      </div>
    `).join('');
  },

  // Match score for source dropdown search
  matchScore(label, query) {
    if (!query) return 1;
    const l = label.toLowerCase();
    const q = query.toLowerCase();
    if (!l.includes(q)) return 0;
    if (l.startsWith(q)) return 4;
    if (l.split(/\W+/).some(w => w.startsWith(q))) return 3;
    return 1;
  },

  readRefForm(type) {
    const form = document.getElementById(`ref-form-${type}`);
    const data = {};

    form.querySelectorAll('input[name]').forEach(field => {
      if (!field.name.startsWith('source_manual_')) {
        data[field.name] = field.value.trim();
      }
    });

    return data;
  },

  // Read secondary ref value — for draft (never saves to ref store)
  readSourceForDraft(type) {
    const state = this.sourceState[type];
    if (!state) return null;
    if (!state.manual) return state.selectedId || null;

    const typeSelect = document.getElementById(`${type}-source-type-select`);
    const refType    = typeSelect?.value || 'book';
    const schema     = SCHEMAS.ref_types[refType];
    const container  = document.getElementById(`${type}-source-manual-fields`);
    if (!schema || !container) return null;

    const refData = { type: refType };
    let hasContent = false;
    Object.keys(schema.fields).forEach(field => {
      const input = container.querySelector(`[name="source_manual_${field}"]`);
      if (input && input.value.trim()) { refData[field] = input.value.trim(); hasContent = true; }
    });
    return hasContent ? refData : null;
  },

  // Read secondary ref value for saving — saves to ref store if checkbox checked
  readSourceForSave(type) {
    const state = this.sourceState[type];
    if (!state) return null;
    if (!state.manual) return state.selectedId || null;

    const typeSelect = document.getElementById(`${type}-source-type-select`);
    const refType    = typeSelect?.value || 'book';
    const schema     = SCHEMAS.ref_types[refType];
    const container  = document.getElementById(`${type}-source-manual-fields`);
    if (!schema || !container) return null;

    const refData = { type: refType };
    let hasContent = false;
    Object.keys(schema.fields).forEach(field => {
      const input = container.querySelector(`[name="source_manual_${field}"]`);
      if (input && input.value.trim()) { refData[field] = input.value.trim(); hasContent = true; }
    });
    if (!hasContent) return null;

    const checkbox = document.getElementById(`${type}-source-save-checkbox`);
    if (checkbox && checkbox.checked) {
      const ref    = refs.createRef(refType, refData);
      const result = refs.validateRef(ref);
      if (result.valid) { storage.saveRef(ref); return ref.id; }
    }
    return refData;
  },

  fillRefForm(type, data) {
    const form = document.getElementById(`ref-form-${type}`);
    if (!form) return;
    form.querySelectorAll('input').forEach(field => {
      if (data[field.name] !== undefined) field.value = data[field.name];
    });
  },

  resetRefForm(type) {
    const form = document.getElementById(`ref-form-${type}`);
    if (!form) return;
    form.querySelectorAll('input').forEach(field => { field.value = ''; });

    // Reset secondary ref state
    if (this.sourceState[type]) {
      this.sourceState[type] = { manual: false, selectedId: null };
      const toggle = document.getElementById(`${type}-source-toggle`);
      const saved  = document.getElementById(`${type}-source-saved`);
      const manual = document.getElementById(`${type}-source-manual`);
      if (toggle) toggle.classList.remove('on');
      if (saved)  saved.style.display  = 'block';
      if (manual) manual.style.display = 'none';
      const fields = document.getElementById(`${type}-source-manual-fields`);
      if (fields) fields.innerHTML = '';
    }
  },

  saveRefDraft(type) { storage.saveRefDraft(type, this.readRefForm(type)); },

  clearRefDraft(type) {
    storage.clearRefDraft(type);
    this.resetRefForm(type);
    this.updateRefDraftIndicator(type);
  },

  updateRefDraftIndicator(type) {
    const draft     = storage.getRefDraft(type);
    const indicator = document.getElementById(`ref-draft-${type}`);
    const btn       = document.querySelector(`#ref-type-buttons .type-btn[data-type="${type}"]`);
    if (!indicator || !btn) return;
    if (draft) {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      indicator.innerHTML = `Draft saved: ${time} <a>Clear</a>`;
      btn.classList.add('has-draft');
    } else {
      indicator.innerHTML = '';
      btn.classList.remove('has-draft');
    }
  },

  saveRef(type) {
    const data = this.readRefForm(type);

    // Attach secondary ref if present
    if (this.primaryRefTypes.includes(type)) {
      const source = this.readSourceForSave(type);
      if (source) {
        if (typeof source === 'string') data.source_id   = source;
        else                           data.source_text = refs.getLabel(source);
      }
    }

    const ref    = refs.createRef(type, data);
    const result = refs.validateRef(ref);
    if (!result.valid) { showToast(result.errors[0]); return; }
    storage.saveRef(ref);
    storage.clearRefDraft(type);
    this.resetRefForm(type);
    this.updateRefDraftIndicator(type);
    showToast('Reference saved ✓');
  },


  // --- Browse references (modal) ---

  openBrowseRefs() {
    const allRefs = storage.getRefsSortedByDate();

    const grouped = {};
    this.refTypes.forEach(type => { grouped[type] = []; });
    allRefs.forEach(ref => { if (grouped[ref.type]) grouped[ref.type].push(ref); });

    const groupsHtml = this.refTypes.map(type => {
      const group = grouped[type];
      if (group.length === 0) return '';
      return `
        <div class="day-group">
          <h3 class="day-header">${SCHEMAS.ref_types[type].label}</h3>
          <div class="card day-card">
            ${group.map(ref => `
              <div class="entry-row card-row ref-row" data-id="${ref.id}">
                <div style="flex:1; min-width:0;">
                  <div class="entry-row-body">${this.escapeHtml(refs.getLabel(ref))}</div>
                </div>
                <span class="entry-row-chevron">›</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    this.openModal('References', allRefs.length === 0
      ? '<div class="empty-message">No references yet.</div>'
      : groupsHtml,
    );

    document.querySelectorAll('.ref-row').forEach(row => {
      row.addEventListener('click', () => {
        const ref = storage.getAllRefs()[row.dataset.id];
        this.openRefDetail(ref);
      });
    });
  },

  openRefDetail(ref) {
    const skip    = ['id', 'created_at', 'type', 'editable']; // kept for safety
    const canEdit = !!ref.editable;

    // Show only fields defined in the ref type schema, in schema order
    const schema    = SCHEMAS.ref_types[ref.type];
    const fieldKeys = schema ? Object.keys(schema.fields) : [];
    const fieldsHtml = fieldKeys
      .filter(key => ref[key])
      .map(key => `
        <div class="card-row" style="flex-direction:column; align-items:flex-start; gap:2px;">
          <span style="color:var(--muted); font-size:13px;">${key}</span>
          <span style="font-size:15px; word-break:break-word;">${this.escapeHtml(String(ref[key]))}</span>
        </div>
      `).join('');

    const typeLabel = SCHEMAS.ref_types[ref.type]?.label || ref.type;
    const date      = new Date(ref.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

    // Populate and show the ref sheet (slides up over the browse modal)
    document.getElementById('ref-sheet-title').textContent = typeLabel;
    document.getElementById('ref-sheet-body').innerHTML = `
      <div style="font-size:12px; color:var(--muted); margin-bottom:0.75rem;">${date}</div>
      <div class="card">${fieldsHtml}</div>
    `;

    const footer    = document.getElementById('ref-sheet-footer');
    const deleteBtn = document.getElementById('ref-sheet-delete-btn');
    footer.style.display = canEdit ? 'block' : 'none';

    // Re-register delete handler
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    newDeleteBtn.addEventListener('click', () => {
      storage.deleteRef(ref.id);
      showToast('Reference deleted');
      this.closeRefSheet();
      this.openBrowseRefs(); // refresh browse modal
    });

    document.getElementById('ref-sheet-overlay').style.display = 'block';
    document.getElementById('ref-sheet').style.display = 'block';
  },

  closeRefSheet() {
    document.getElementById('ref-sheet-overlay').style.display = 'none';
    document.getElementById('ref-sheet').style.display = 'none';
  },


  // --- Helpers ---

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

};
