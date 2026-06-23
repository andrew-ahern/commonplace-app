/* ============================================================
   ui.newentry.js
   Handles all interactions on the New Entry screen.

   Ref selector behaviour (quote & marginalium):
   - Default: searchable dropdown of saved refs
   - Toggle "Enter manually" → inline ref form appears
     - Ref type selector + fields for that type
     - "Save to references" checkbox (off by default)
     - On entry save: if checked, ref saved to ref store (ref_id string)
                      if unchecked, ref embedded inline (ref object)
   ============================================================ */


const uiNewEntry = {

  types:    ['note', 'word', 'quote', 'marginalium'],
  refTypes: ['quote', 'marginalium'],
  tagTypes: ['note', 'quote', 'marginalium'],
  activeType: 'note',

  // Ref types that have a "Published in" secondary ref field
  primaryRefTypes:   ['novel', 'novella', 'short_story', 'poem', 'play', 'essay', 'speech'],
  secondaryRefTypes: ['book', 'other'],

  // Per-type ref selector state
  refState: {
    quote:       { manual: false, selectedId: null, selectedRefType: 'novel', sourceState: { manual: false, selectedId: null } },
    marginalium: { manual: false, selectedId: null, selectedRefType: 'novel', sourceState: { manual: false, selectedId: null } },
  },


  // --- Initialisation ---

  init() {
    this.buildRefSelectors();
    this.restoreAllDrafts();
    this.registerTypeButtonHandlers();
    this.registerFormHandlers();
    this.updateAllDraftIndicators();
  },


  // --- Build ref selectors ---

  // Inject the ref selector HTML into each ref-selector placeholder
  buildRefSelectors() {
    this.refTypes.forEach(type => {
      const container = document.getElementById(`${type}-ref-selector`);
      if (!container) return;
      container.innerHTML = this.refSelectorHtml(type);
      this.registerRefSelectorHandlers(type);
    });
  },

  refSelectorHtml(type) {
    const refTypeOptions = Object.keys(SCHEMAS.ref_types)
      .map(rt => `<option value="${rt}">${SCHEMAS.ref_types[rt].label}</option>`)
      .join('');

    return `
      <!-- Label row: "Reference" on left, toggle on right -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
        <label style="font-size:13px; color:var(--muted);">Reference</label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <span style="font-size:12px; color:var(--muted);">Enter manually</span>
          <div class="toggle-switch" id="${type}-manual-toggle" data-entry-type="${type}">
            <div class="toggle-knob"></div>
          </div>
        </label>
      </div>

      <!-- Saved ref search (default) -->
      <div id="${type}-ref-saved" class="ref-saved-section">
        <input type="text" class="ref-search" id="${type}-ref-search"
               placeholder="Search references…" autocomplete="off">
        <div class="ref-dropdown" id="${type}-ref-dropdown"></div>
      </div>

      <!-- Manual ref entry (shown when toggle is on) -->
      <div id="${type}-ref-manual" class="ref-manual-section" style="display:none;">
        <select class="ref-type-select" id="${type}-ref-type-select">
          ${refTypeOptions}
        </select>
        <div class="ref-manual-fields" id="${type}-ref-manual-fields"></div>
        <label style="display:flex; align-items:center; gap:8px; margin-top:8px; font-size:13px; color:var(--muted); cursor:pointer;">
          <input type="checkbox" id="${type}-ref-save-checkbox" style="width:15px; height:15px; cursor:pointer;">
          Save to references
        </label>
      </div>
    `;
  },


  // --- Ref selector handlers ---

  registerRefSelectorHandlers(type) {
    const state = this.refState[type];

    // Toggle switch
    const toggle = document.getElementById(`${type}-manual-toggle`);
    toggle.addEventListener('click', () => {
      state.manual = !state.manual;
      toggle.classList.toggle('on', state.manual);
      document.getElementById(`${type}-ref-saved`).style.display  = state.manual ? 'none'  : 'block';
      document.getElementById(`${type}-ref-manual`).style.display = state.manual ? 'block' : 'none';
      if (state.manual) this.buildManualRefFields(type);
    });

    // Saved ref search
    const search   = document.getElementById(`${type}-ref-search`);
    const dropdown = document.getElementById(`${type}-ref-dropdown`);

    search.addEventListener('focus', () => {
      this.renderRefDropdown(type, search.value);
      dropdown.style.display = 'block';
    });

    search.addEventListener('input', () => {
      state.selectedId = null;
      this.renderRefDropdown(type, search.value);
      dropdown.style.display = 'block';
    });

    document.addEventListener('click', e => {
      const selector = document.getElementById(`${type}-ref-selector`);
      if (selector && !selector.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Ref type select (manual mode)
    const typeSelect = document.getElementById(`${type}-ref-type-select`);
    typeSelect.addEventListener('change', () => {
      state.selectedRefType = typeSelect.value;
      this.buildManualRefFields(type);
    });
  },

  // Ref type categories for grouped dropdown display
  refTypeCategories: [
    { label: 'Books & long works', types: ['book', 'novel', 'novella'] },
    { label: 'Short works',        types: ['short_story', 'poem', 'play', 'essay'] },
    { label: 'Academic',           types: ['journal_article'] },
    { label: 'Articles',           types: ['article'] },
    { label: 'Audio & visual',     types: ['speech', 'broadcast', 'film'] },
    { label: 'Other',              types: ['other'] },
  ],

  // Render the grouped searchable dropdown
  renderRefDropdown(entryType, query) {
    const dropdown = document.getElementById(`${entryType}-ref-dropdown`);
    const allRefs  = Object.values(storage.getAllRefs());

    // Build lookup: refType -> ranked refs
    const byType = {};
    Object.keys(SCHEMAS.ref_types).forEach(rt => { byType[rt] = []; });
    allRefs.forEach(ref => {
      if (!byType[ref.type]) return;
      const label = refs.getLabel(ref);
      const score = this.matchScore(label, query);
      if (score > 0 || !query) byType[ref.type].push({ ref, label, score });
    });
    Object.keys(byType).forEach(rt => byType[rt].sort((a, b) => b.score - a.score));

    // Render by category — skip empty categories
    const html = this.refTypeCategories.map(cat => {
      const items = cat.types.flatMap(rt => byType[rt] || []).map(({ ref, label }) =>
        `<div class="ref-option" data-id="${ref.id}" data-label="${this.escapeAttr(label)}">${this.escapeHtml(label)}</div>`
      ).join('');
      if (!items) return '';
      return `<div class="ref-group-header">${cat.label}</div>${items}`;
    }).join('');

    dropdown.innerHTML = html || '<div class="ref-no-results">No references found</div>';

    dropdown.querySelectorAll('.ref-option').forEach(option => {
      option.addEventListener('click', () => {
        this.refState[entryType].selectedId = option.dataset.id;
        document.getElementById(`${entryType}-ref-search`).value = option.dataset.label;
        dropdown.style.display = 'none';
      });
    });
  },

  // Relevance score for ref search
  matchScore(label, query) {
    if (!query) return 1;
    const l = label.toLowerCase();
    const q = query.toLowerCase();
    if (!l.includes(q)) return 0;
    if (l.startsWith(q)) return 4;
    if (l.split(/\W+/).some(w => w.startsWith(q))) return 3;
    return 1;
  },

  // Build manual ref fields for selected ref type
  buildManualRefFields(entryType) {
    const refType   = document.getElementById(`${entryType}-ref-type-select`).value;
    const schema    = SCHEMAS.ref_types[refType];
    const container = document.getElementById(`${entryType}-ref-manual-fields`);

    // Filter out source_id/source_text — handled by "Published in" field
    const fields = Object.keys(schema.fields)
      .filter(f => f !== 'source_id' && f !== 'source_text')
      .map(field => `
        <div class="field" style="margin-top:6px;">
          <label style="font-size:12px; color:var(--muted);">${field}</label>
          <input type="text" class="ref-manual-input" name="ref_manual_${field}"
                 style="margin-top:2px;">
        </div>
      `).join('');

    // Add "Published in" field for primary ref types
    const publishedIn = this.primaryRefTypes.includes(refType)
      ? this.buildPublishedInHtml(entryType, refType)
      : '';

    container.innerHTML = fields + publishedIn;

    // Register "Published in" handlers if needed
    if (this.primaryRefTypes.includes(refType)) {
      this.refState[entryType].sourceState = { manual: false, selectedId: null };
      this.registerEntrySourceHandlers(entryType, refType);
    }
  },

  // Generate "Published in" HTML for entry form
  buildPublishedInHtml(entryType, refType) {
    const secondaryTypeOptions = this.secondaryRefTypes
      .map(rt => `<option value="${rt}">${SCHEMAS.ref_types[rt].label}</option>`)
      .join('');

    return `
      <div class="field" style="margin-top:6px;" id="${entryType}-entry-source-field">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <label style="font-size:12px; color:var(--muted);">Published in</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <span style="font-size:11px; color:var(--muted);">Enter manually</span>
            <div class="toggle-switch" id="${entryType}-entry-source-toggle">
              <div class="toggle-knob"></div>
            </div>
          </label>
        </div>
        <div id="${entryType}-entry-source-saved">
          <input type="text" class="ref-search" id="${entryType}-entry-source-search"
                 placeholder="Search references…" autocomplete="off" style="font-size:14px;">
          <div class="ref-dropdown" id="${entryType}-entry-source-dropdown"></div>
          <input type="hidden" name="ref_source_id">
        </div>
        <div id="${entryType}-entry-source-manual" style="display:none;">
          <select class="ref-type-select" id="${entryType}-entry-source-type-select"
                  style="font-size:13px;">
            ${secondaryTypeOptions}
          </select>
          <div class="ref-manual-fields" id="${entryType}-entry-source-manual-fields"></div>
          <label style="display:flex; align-items:center; gap:8px; margin-top:8px;
                        font-size:12px; color:var(--muted); cursor:pointer;">
            <input type="checkbox" id="${entryType}-entry-source-save-checkbox"
                   style="width:14px; height:14px; cursor:pointer;">
            Save to references
          </label>
        </div>
      </div>
    `;
  },

  // Register handlers for entry form "Published in" field
  registerEntrySourceHandlers(entryType, refType) {
    const state    = this.refState[entryType].sourceState;
    const toggle   = document.getElementById(`${entryType}-entry-source-toggle`);
    const saved    = document.getElementById(`${entryType}-entry-source-saved`);
    const manual   = document.getElementById(`${entryType}-entry-source-manual`);
    const search   = document.getElementById(`${entryType}-entry-source-search`);
    const dropdown = document.getElementById(`${entryType}-entry-source-dropdown`);
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      state.manual = !state.manual;
      toggle.classList.toggle('on', state.manual);
      saved.style.display  = state.manual ? 'none'  : 'block';
      manual.style.display = state.manual ? 'block' : 'none';
      if (state.manual) this.buildEntrySourceFields(entryType);
    });

    search.addEventListener('focus', () => {
      this.renderEntrySourceDropdown(entryType, search.value);
      dropdown.style.display = 'block';
    });

    search.addEventListener('input', () => {
      state.selectedId = null;
      this.renderEntrySourceDropdown(entryType, search.value);
      dropdown.style.display = 'block';
    });

    document.addEventListener('click', e => {
      const field = document.getElementById(`${entryType}-entry-source-field`);
      if (field && !field.contains(e.target)) dropdown.style.display = 'none';
    });

    const typeSelect = document.getElementById(`${entryType}-entry-source-type-select`);
    if (typeSelect) typeSelect.addEventListener('change', () => this.buildEntrySourceFields(entryType));
  },

  renderEntrySourceDropdown(entryType, query) {
    const dropdown = document.getElementById(`${entryType}-entry-source-dropdown`);
    const allRefs  = Object.values(storage.getAllRefs())
      .filter(r => this.secondaryRefTypes.includes(r.type));

    const ranked = allRefs.map(ref => ({
      ref, label: refs.getLabel(ref),
      score: this.matchScore(refs.getLabel(ref), query),
    })).filter(({ score }) => score > 0 || !query)
       .sort((a, b) => b.score - a.score);

    const html = ranked.map(({ ref, label }) =>
      `<div class="ref-option" data-id="${ref.id}"
            data-label="${this.escapeAttr(label)}">${this.escapeHtml(label)}</div>`
    ).join('');

    dropdown.innerHTML = html || '<div class="ref-no-results">No references found</div>';

    dropdown.querySelectorAll('.ref-option').forEach(option => {
      option.addEventListener('click', () => {
        this.refState[entryType].sourceState.selectedId = option.dataset.id;
        document.getElementById(`${entryType}-entry-source-search`).value = option.dataset.label;
        document.querySelector(`#${entryType}-entry-source-field [name="ref_source_id"]`).value = option.dataset.id;
        dropdown.style.display = 'none';
      });
    });
  },

  buildEntrySourceFields(entryType) {
    const typeSelect = document.getElementById(`${entryType}-entry-source-type-select`);
    const refType    = typeSelect?.value || 'book';
    const schema     = SCHEMAS.ref_types[refType];
    const container  = document.getElementById(`${entryType}-entry-source-manual-fields`);
    if (!container) return;

    container.innerHTML = Object.keys(schema.fields).map(field => `
      <div class="field" style="margin-top:4px;">
        <label style="font-size:11px; color:var(--muted);">${field}</label>
        <input type="text" class="ref-manual-input" name="entry_source_manual_${field}"
               style="margin-top:2px; font-size:13px;">
      </div>
    `).join('');
  },

  // Read the current ref value — for draft saving only, never saves to ref store
  readRefForDraft(entryType) {
    const state = this.refState[entryType];
    if (!state.manual) return state.selectedId || null;

    const refType   = document.getElementById(`${entryType}-ref-type-select`)?.value;
    const schema    = SCHEMAS.ref_types[refType];
    const container = document.getElementById(`${entryType}-ref-manual-fields`);
    if (!schema || !container) return null;

    const refData    = { type: refType };
    let   hasContent = false;
    Object.keys(schema.fields)
      .filter(f => f !== 'source_id' && f !== 'source_text')
      .forEach(field => {
        const input = container.querySelector(`[name="ref_manual_${field}"]`);
        if (input && input.value.trim()) { refData[field] = input.value.trim(); hasContent = true; }
      });

    // Read secondary ref for draft (never saves)
    if (this.primaryRefTypes.includes(refType)) {
      const source = this.readEntrySourceForDraft(entryType);
      if (source) {
        if (typeof source === 'string') refData.source_id   = source;
        else                           refData.source_text = refs.getLabel(source);
      }
    }

    return hasContent ? refData : null;
  },

  readEntrySourceForDraft(entryType) {
    const state = this.refState[entryType].sourceState;
    if (!state) return null;
    if (!state.manual) return state.selectedId || null;

    const typeSelect = document.getElementById(`${entryType}-entry-source-type-select`);
    const refType    = typeSelect?.value || 'book';
    const schema     = SCHEMAS.ref_types[refType];
    const container  = document.getElementById(`${entryType}-entry-source-manual-fields`);
    if (!schema || !container) return null;

    const refData = { type: refType };
    let hasContent = false;
    Object.keys(schema.fields).forEach(field => {
      const input = container.querySelector(`[name="entry_source_manual_${field}"]`);
      if (input && input.value.trim()) { refData[field] = input.value.trim(); hasContent = true; }
    });
    return hasContent ? refData : null;
  },

  // Read the ref value for saving an entry — saves to ref store if checkbox checked
  readRefForSave(entryType) {
    const state = this.refState[entryType];
    if (!state.manual) return state.selectedId || null;

    const refType   = document.getElementById(`${entryType}-ref-type-select`)?.value;
    const schema    = SCHEMAS.ref_types[refType];
    const container = document.getElementById(`${entryType}-ref-manual-fields`);
    if (!schema || !container) return null;

    const refData    = { type: refType };
    let   hasContent = false;
    Object.keys(schema.fields)
      .filter(f => f !== 'source_id' && f !== 'source_text')
      .forEach(field => {
        const input = container.querySelector(`[name="ref_manual_${field}"]`);
        if (input && input.value.trim()) { refData[field] = input.value.trim(); hasContent = true; }
      });
    if (!hasContent) return null;

    // Attach secondary ref if present
    if (this.primaryRefTypes.includes(refType)) {
      const source = this.readEntrySourceForSave(entryType);
      if (source) {
        if (typeof source === 'string') refData.source_id   = source;
        else                           refData.source_text = refs.getLabel(source);
      }
    }

    // Save to references if checkbox checked
    const saveCheckbox = document.getElementById(`${entryType}-ref-save-checkbox`);
    if (saveCheckbox && saveCheckbox.checked) {
      const ref    = refs.createRef(refType, refData);
      const result = refs.validateRef(ref);
      if (result.valid) { storage.saveRef(ref); return ref.id; }
    }
    return refData;
  },

  readEntrySourceForSave(entryType) {
    const state = this.refState[entryType].sourceState;
    if (!state) return null;
    if (!state.manual) return state.selectedId || null;

    const typeSelect = document.getElementById(`${entryType}-entry-source-type-select`);
    const refType    = typeSelect?.value || 'book';
    const schema     = SCHEMAS.ref_types[refType];
    const container  = document.getElementById(`${entryType}-entry-source-manual-fields`);
    if (!schema || !container) return null;

    const refData = { type: refType };
    let hasContent = false;
    Object.keys(schema.fields).forEach(field => {
      const input = container.querySelector(`[name="entry_source_manual_${field}"]`);
      if (input && input.value.trim()) { refData[field] = input.value.trim(); hasContent = true; }
    });
    if (!hasContent) return null;

    const checkbox = document.getElementById(`${entryType}-entry-source-save-checkbox`);
    if (checkbox && checkbox.checked) {
      const ref    = refs.createRef(refType, refData);
      const result = refs.validateRef(ref);
      if (result.valid) { storage.saveRef(ref); return ref.id; }
    }
    return refData;
  },

  // Reset ref selector to default state
  resetRef(entryType) {
    const state         = this.refState[entryType];
    state.selectedId    = null;
    state.manual        = false;

    const toggle   = document.getElementById(`${entryType}-manual-toggle`);
    const saved    = document.getElementById(`${entryType}-ref-saved`);
    const manual   = document.getElementById(`${entryType}-ref-manual`);
    const search   = document.getElementById(`${entryType}-ref-search`);
    const checkbox = document.getElementById(`${entryType}-ref-save-checkbox`);

    if (toggle)   toggle.classList.remove('on');
    if (saved)    saved.style.display  = 'block';
    if (manual)   manual.style.display = 'none';
    if (search)   search.value = '';
    if (checkbox) checkbox.checked = false;

    const fields = document.getElementById(`${entryType}-ref-manual-fields`);
    if (fields) fields.innerHTML = '';
  },


  // --- Type switching ---

  registerTypeButtonHandlers() {
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchType(btn.dataset.type));
    });
  },

  switchType(type) {
    this.activeType = type;
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    document.querySelectorAll('.entry-form').forEach(form => {
      form.classList.toggle('active', form.id === `form-${type}`);
    });
  },


  // --- Form handlers ---

  registerFormHandlers() {
    this.types.forEach(type => {
      const form = document.getElementById(`form-${type}`);
      if (!form) return;

      form.addEventListener('input', () => {
        this.saveDraft(type);
        this.updateDraftIndicator(type);
      });

      form.querySelector('.save-btn').addEventListener('click', () => {
        this.saveEntry(type);
      });

      const indicator = document.getElementById(`draft-${type}`);
      if (indicator) {
        indicator.addEventListener('click', e => {
          if (e.target.tagName === 'A') this.clearDraft(type);
        });
      }
    });

    this.tagTypes.forEach(type => this.registerTagAutocomplete(type));
  },


  // --- Tag autocomplete ---

  registerTagAutocomplete(type) {
    const input       = document.getElementById(`${type}-tags`);
    const suggestions = document.getElementById(`${type}-tag-suggestions`);
    if (!input || !suggestions) return;

    input.addEventListener('input', () => {
      const parts   = input.value.split(',');
      const current = parts[parts.length - 1].trim();
      const matches = tags.getSuggestions(current);

      if (matches.length === 0 || !current) {
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
        return;
      }

      suggestions.innerHTML = matches.map(tag =>
        `<div class="tag-suggestion">${tag}</div>`
      ).join('');
      suggestions.style.display = 'block';

      suggestions.querySelectorAll('.tag-suggestion').forEach(el => {
        el.addEventListener('click', () => {
          parts[parts.length - 1] = el.textContent + ', ';
          input.value = parts.join(', ').replace(/,\s*,/g, ',');
          suggestions.innerHTML = '';
          suggestions.style.display = 'none';
          input.focus();
        });
      });
    });

    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !suggestions.contains(e.target)) {
        suggestions.style.display = 'none';
      }
    });
  },


  // --- Form read / fill / reset ---

  readForm(type, forSave = false) {
    const form = document.getElementById(`form-${type}`);
    const data = {};

    form.querySelectorAll('input[name], textarea[name]').forEach(field => {
      if (field.name && !field.name.startsWith('ref_manual_')) {
        data[field.name] = field.value.trim();
      }
    });

    // Save full ref selector state for draft restoration
    if (this.refTypes.includes(type)) {
      const state     = this.refState[type];
      const refData   = forSave ? this.readRefForSave(type) : this.readRefForDraft(type);
      if (refData) data.ref = refData;

      // Save selector UI state separately so draft can be fully restored
      data._refDraftState = {
        manual:          state.manual,
        selectedId:      state.selectedId,
        selectedRefType: document.getElementById(`${type}-ref-type-select`)?.value || state.selectedRefType,
        searchText:      document.getElementById(`${type}-ref-search`)?.value || '',
        manualFields:    {},
      };

      // Save all manual field values
      const manualContainer = document.getElementById(`${type}-ref-manual-fields`);
      if (manualContainer) {
        manualContainer.querySelectorAll('input[name]').forEach(input => {
          const field = input.name.replace('ref_manual_', '');
          data._refDraftState.manualFields[field] = input.value.trim();
        });
      }

      // Save checkbox state
      const checkbox = document.getElementById(`${type}-ref-save-checkbox`);
      if (checkbox) data._refDraftState.saveChecked = checkbox.checked;
    }

    return data;
  },

  fillForm(type, data) {
    const form = document.getElementById(`form-${type}`);
    form.querySelectorAll('input[name], textarea[name]').forEach(field => {
      if (field.name && data[field.name] !== undefined && !field.name.startsWith('_')) {
        field.value = data[field.name];
      }
    });

    // Fully restore ref selector state from draft
    if (this.refTypes.includes(type) && data._refDraftState) {
      const ds    = data._refDraftState;
      const state = this.refState[type];

      if (ds.manual) {
        // Toggle on
        state.manual = true;
        state.selectedRefType = ds.selectedRefType || state.selectedRefType;
        const toggle = document.getElementById(`${type}-manual-toggle`);
        const saved  = document.getElementById(`${type}-ref-saved`);
        const manual = document.getElementById(`${type}-ref-manual`);
        if (toggle) toggle.classList.add('on');
        if (saved)  saved.style.display  = 'none';
        if (manual) manual.style.display = 'block';

        // Set ref type select
        const typeSelect = document.getElementById(`${type}-ref-type-select`);
        if (typeSelect && ds.selectedRefType) {
          typeSelect.value = ds.selectedRefType;
        }

        // Build fields for the selected ref type
        this.buildManualRefFields(type);

        // Restore manual field values
        if (ds.manualFields) {
          const container = document.getElementById(`${type}-ref-manual-fields`);
          if (container) {
            Object.entries(ds.manualFields).forEach(([field, value]) => {
              const input = container.querySelector(`[name="ref_manual_${field}"]`);
              if (input) input.value = value;
            });
          }
        }

        // Restore checkbox
        const checkbox = document.getElementById(`${type}-ref-save-checkbox`);
        if (checkbox && ds.saveChecked) checkbox.checked = true;

      } else if (ds.selectedId) {
        // Saved ref selected
        state.selectedId = ds.selectedId;
        const saved = storage.getAllRefs()[ds.selectedId];
        if (saved) {
          const search = document.getElementById(`${type}-ref-search`);
          if (search) search.value = refs.getLabel(saved);
        }
      } else if (ds.searchText) {
        // Search text typed but nothing selected yet
        const search = document.getElementById(`${type}-ref-search`);
        if (search) search.value = ds.searchText;
      }
    }
  },

  resetForm(type) {
    const form = document.getElementById(`form-${type}`);
    form.querySelectorAll('input[name], textarea[name]').forEach(field => {
      field.value = '';
    });
    if (this.refTypes.includes(type)) this.resetRef(type);
  },


  // --- Save entry ---

  saveEntry(type) {
    const data   = this.readForm(type, true);
    const entry  = entries.createEntry(type, data);
    const result = entries.validateEntry(entry);

    if (!result.valid) {
      this.showError(type, result.errors.join('\n'));
      return;
    }

    if (data.tags) tags.addFromString(data.tags);

    storage.saveEntry(entry);
    storage.clearDraft(type);
    this.resetForm(type);
    this.updateDraftIndicator(type);
    this.clearError(type);
    showToast('Entry saved ✓');
  },


  // --- Draft ---

  saveDraft(type) {
    storage.saveDraft(type, this.readForm(type));
  },

  restoreAllDrafts() {
    this.types.forEach(type => {
      const draft = storage.getDraft(type);
      if (draft) this.fillForm(type, draft);
    });
  },

  clearDraft(type) {
    storage.clearDraft(type);
    this.resetForm(type);
    this.updateDraftIndicator(type);
  },

  updateAllDraftIndicators() {
    this.types.forEach(type => this.updateDraftIndicator(type));
  },

  updateDraftIndicator(type) {
    const draft     = storage.getDraft(type);
    const indicator = document.getElementById(`draft-${type}`);
    const btn       = document.querySelector(`.type-btn[data-type="${type}"]`);
    if (draft) {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      indicator.innerHTML = `Draft saved: ${time} <a>Clear</a>`;
      btn.classList.add('has-draft');
    } else {
      indicator.innerHTML = '';
      btn.classList.remove('has-draft');
    }
  },


  // --- Inline errors ---

  showError(type, message) {
    const form = document.getElementById(`form-${type}`);
    let err = form.querySelector('.form-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'form-error';
      form.querySelector('.save-btn').insertAdjacentElement('beforebegin', err);
    }
    err.textContent = message;
  },

  clearError(type) {
    const form = document.getElementById(`form-${type}`);
    const err  = form.querySelector('.form-error');
    if (err) err.remove();
  },


  // --- Helpers ---

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;');
  },

};
