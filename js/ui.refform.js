/* ============================================================
   ui.refform.js
   Shared ref form logic used by both ui.settings.js and
   ui.newentry.js. Any change here is automatically reflected
   in both the Settings "Add new reference" form and the
   New Entry "Enter manually" ref form.

   Key concepts:
   - idPrefix: a unique string that namespaces all element IDs
     for a given form instance, preventing conflicts when
     multiple ref forms exist on the same page.
     Settings uses the ref type (e.g. "novel").
     Entry form uses the entry type + suffix (e.g. "quote-entry").
   - sourceState: an object { manual, selectedId } tracking
     the "Published in" selector state for a given form.
   ============================================================ */


const uiRefForm = {

  // Ref types that have a "Published in" secondary ref field
  primaryRefTypes:   ['novel', 'novella', 'short_story', 'poem', 'play', 'essay', 'speech'],

  // Allowed types for secondary (Published in) refs
  secondaryRefTypes: ['book', 'other'],


  // --- HTML builders ---

  // Build the full form HTML for a given ref type
  // idPrefix: namespaces all element IDs (e.g. 'novel', 'quote-entry')
  buildRefFormHtml(refType, idPrefix) {
    const schema = SCHEMAS.ref_types[refType];
    if (!schema) return '';

    const fields = Object.keys(schema.fields)
      .filter(f => f !== 'source_id' && f !== 'source_text')
      .map(field => `
        <div class="field">
          <label>${field}</label>
          <input type="text" name="${idPrefix}_${field}">
        </div>
      `).join('');

    const publishedIn = this.primaryRefTypes.includes(refType)
      ? this.buildPublishedInHtml(idPrefix)
      : '';

    return `<div class="card form-card">${fields}${publishedIn}</div>`;
  },

  // Build the "Published in" field HTML
  buildPublishedInHtml(idPrefix) {
    const secondaryTypeOptions = this.secondaryRefTypes
      .map(rt => `<option value="${rt}">${SCHEMAS.ref_types[rt].label}</option>`)
      .join('');

    return `
      <div class="field" id="${idPrefix}-pub-field">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <label style="font-size:13px; color:var(--muted);">Published in</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <span style="font-size:12px; color:var(--muted);">Enter manually</span>
            <div class="toggle-switch" id="${idPrefix}-pub-toggle">
              <div class="toggle-knob"></div>
            </div>
          </label>
        </div>
        <div id="${idPrefix}-pub-saved">
          <input type="text" class="ref-search" id="${idPrefix}-pub-search"
                 placeholder="Search references…" autocomplete="off">
          <div class="ref-dropdown" id="${idPrefix}-pub-dropdown"></div>
          <input type="hidden" name="${idPrefix}_source_id">
        </div>
        <div id="${idPrefix}-pub-manual" style="display:none;">
          <select class="ref-type-select" id="${idPrefix}-pub-type-select">
            ${secondaryTypeOptions}
          </select>
          <div id="${idPrefix}-pub-manual-fields"></div>
          <label style="display:flex; align-items:center; gap:8px; margin-top:8px;
                        font-size:13px; color:var(--muted); cursor:pointer;">
            <input type="checkbox" id="${idPrefix}-pub-save-checkbox"
                   style="width:15px; height:15px; cursor:pointer;">
            Save to references
          </label>
        </div>
      </div>
    `;
  },

  // Build manual fields for a secondary ref type
  buildSecondaryFieldsHtml(refType, idPrefix) {
    const schema = SCHEMAS.ref_types[refType];
    if (!schema) return '';
    return Object.keys(schema.fields).map(field => `
      <div class="field" style="margin-top:6px;">
        <label style="font-size:12px; color:var(--muted);">${field}</label>
        <input type="text" class="ref-manual-input" name="${idPrefix}_pub_${field}"
               style="margin-top:2px;">
      </div>
    `).join('');
  },


  // --- Handlers ---

  // Register all "Published in" event handlers for a form instance
  // onDraftChange: callback to trigger draft save + indicator update
  registerPublishedInHandlers(idPrefix, state, onDraftChange) {
    const toggle   = document.getElementById(`${idPrefix}-pub-toggle`);
    const saved    = document.getElementById(`${idPrefix}-pub-saved`);
    const manual   = document.getElementById(`${idPrefix}-pub-manual`);
    const search   = document.getElementById(`${idPrefix}-pub-search`);
    const dropdown = document.getElementById(`${idPrefix}-pub-dropdown`);
    if (!toggle) return;

    // Toggle
    toggle.addEventListener('click', () => {
      state.manual = !state.manual;
      toggle.classList.toggle('on', state.manual);
      saved.style.display  = state.manual ? 'none'  : 'block';
      manual.style.display = state.manual ? 'block' : 'none';
      if (state.manual) this.buildSecondaryFields(idPrefix);
      if (onDraftChange) onDraftChange();
    });

    // Search
    search.addEventListener('focus', () => {
      this.renderSecondaryDropdown(idPrefix, search.value, state);
      dropdown.style.display = 'block';
    });

    search.addEventListener('input', () => {
      state.selectedId = null;
      const hidden = document.querySelector(`[name="${idPrefix}_source_id"]`);
      if (hidden) hidden.value = '';
      this.renderSecondaryDropdown(idPrefix, search.value, state);
      dropdown.style.display = 'block';
    });

    document.addEventListener('click', e => {
      const field = document.getElementById(`${idPrefix}-pub-field`);
      if (field && !field.contains(e.target)) dropdown.style.display = 'none';
    });

    // Secondary type select
    const typeSelect = document.getElementById(`${idPrefix}-pub-type-select`);
    if (typeSelect) {
      typeSelect.addEventListener('change', () => this.buildSecondaryFields(idPrefix));
    }
  },

  // Build secondary ref fields for currently selected type
  buildSecondaryFields(idPrefix) {
    const typeSelect = document.getElementById(`${idPrefix}-pub-type-select`);
    const refType    = typeSelect?.value || 'book';
    const container  = document.getElementById(`${idPrefix}-pub-manual-fields`);
    if (!container) return;
    container.innerHTML = this.buildSecondaryFieldsHtml(refType, idPrefix);
  },

  // Render the secondary ref dropdown
  renderSecondaryDropdown(idPrefix, query, state) {
    const dropdown = document.getElementById(`${idPrefix}-pub-dropdown`);
    const allRefs  = Object.values(storage.getAllRefs())
      .filter(r => this.secondaryRefTypes.includes(r.type));

    const ranked = allRefs
      .map(ref => ({ ref, label: refs.getLabel(ref), score: this.matchScore(refs.getLabel(ref), query) }))
      .filter(({ score }) => score > 0 || !query)
      .sort((a, b) => b.score - a.score);

    const html = ranked.map(({ ref, label }) =>
      `<div class="ref-option" data-id="${ref.id}"
            data-label="${label.replace(/"/g, '&quot;')}">${this.escapeHtml(label)}</div>`
    ).join('');

    dropdown.innerHTML = html || '<div class="ref-no-results">No references found</div>';

    dropdown.querySelectorAll('.ref-option').forEach(option => {
      option.addEventListener('click', () => {
        state.selectedId = option.dataset.id;
        document.getElementById(`${idPrefix}-pub-search`).value = option.dataset.label;
        const hidden = document.querySelector(`[name="${idPrefix}_source_id"]`);
        if (hidden) hidden.value = option.dataset.id;
        dropdown.style.display = 'none';
      });
    });
  },


  // --- Reading ---

  // Read all primary ref form fields (excluding secondary manual fields)
  readFormData(idPrefix, refType) {
    const schema = SCHEMAS.ref_types[refType];
    if (!schema) return {};
    const data = {};
    Object.keys(schema.fields)
      .filter(f => f !== 'source_id' && f !== 'source_text')
      .forEach(field => {
        const input = document.querySelector(`[name="${idPrefix}_${field}"]`);
        if (input) data[field] = input.value.trim();
      });
    return data;
  },

  // Read secondary ref — for draft only, never saves to ref store
  readSourceForDraft(idPrefix, state) {
    if (!state.manual) return state.selectedId || null;

    const typeSelect = document.getElementById(`${idPrefix}-pub-type-select`);
    const refType    = typeSelect?.value || 'book';
    const schema     = SCHEMAS.ref_types[refType];
    if (!schema) return null;

    const refData = { type: refType };
    let hasContent = false;
    Object.keys(schema.fields).forEach(field => {
      const input = document.querySelector(`[name="${idPrefix}_pub_${field}"]`);
      if (input && input.value.trim()) { refData[field] = input.value.trim(); hasContent = true; }
    });
    return hasContent ? refData : null;
  },

  // Read secondary ref for saving — saves to ref store if checkbox checked
  readSourceForSave(idPrefix, state) {
    if (!state.manual) return state.selectedId || null;

    const typeSelect = document.getElementById(`${idPrefix}-pub-type-select`);
    const refType    = typeSelect?.value || 'book';
    const schema     = SCHEMAS.ref_types[refType];
    if (!schema) return null;

    const refData = { type: refType };
    let hasContent = false;
    Object.keys(schema.fields).forEach(field => {
      const input = document.querySelector(`[name="${idPrefix}_pub_${field}"]`);
      if (input && input.value.trim()) { refData[field] = input.value.trim(); hasContent = true; }
    });
    if (!hasContent) return null;

    const checkbox = document.getElementById(`${idPrefix}-pub-save-checkbox`);
    if (checkbox && checkbox.checked) {
      const ref    = refs.createRef(refType, refData);
      const result = refs.validateRef(ref);
      if (result.valid) { storage.saveRef(ref); return ref.id; }
    }
    return refData;
  },


  // --- Reset ---

  resetPublishedIn(idPrefix, state) {
    state.manual     = false;
    state.selectedId = null;

    const toggle   = document.getElementById(`${idPrefix}-pub-toggle`);
    const saved    = document.getElementById(`${idPrefix}-pub-saved`);
    const manual   = document.getElementById(`${idPrefix}-pub-manual`);
    const search   = document.getElementById(`${idPrefix}-pub-search`);
    const fields   = document.getElementById(`${idPrefix}-pub-manual-fields`);
    const hidden   = document.querySelector(`[name="${idPrefix}_source_id"]`);
    const checkbox = document.getElementById(`${idPrefix}-pub-save-checkbox`);

    if (toggle)   toggle.classList.remove('on');
    if (saved)    saved.style.display  = 'block';
    if (manual)   manual.style.display = 'none';
    if (search)   search.value = '';
    if (fields)   fields.innerHTML = '';
    if (hidden)   hidden.value = '';
    if (checkbox) checkbox.checked = false;
  },


  // --- Helpers ---

  matchScore(label, query) {
    if (!query) return 1;
    const l = label.toLowerCase();
    const q = query.toLowerCase();
    if (!l.includes(q)) return 0;
    if (l.startsWith(q)) return 4;
    if (l.split(/\W+/).some(w => w.startsWith(q))) return 3;
    return 1;
  },

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

};
