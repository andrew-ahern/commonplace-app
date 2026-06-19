/* ============================================================
   ui.browse.js
   Handles all interactions on the Library screen.
   Entries grouped by day, tapping opens a bottom sheet.
   ref field on entries can be a ref_id string or inline object.
   ============================================================ */


const uiBrowse = {

  init() {
    this.renderEntryList();
    this.registerSheetHandlers();
  },


  // --- Entry list ---

  renderEntryList() {
    const list = document.getElementById('entry-list');
    const all  = storage.getEntriesSortedByDate();

    if (all.length === 0) {
      list.innerHTML = '<div class="empty-message">No entries yet.</div>';
      return;
    }

    const byDate = {};
    all.forEach(entry => {
      const day = entry.created_at.slice(0, 10);
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push(entry);
    });

    list.innerHTML = Object.keys(byDate).sort().reverse().map(day => `
      <div class="day-group">
        <h3 class="day-header">${this.formatDayHeader(day)}</h3>
        <div class="card day-card">
          ${byDate[day].map(entry => this.renderRow(entry)).join('')}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.entry-row').forEach(row => {
      row.addEventListener('click', () => {
        const entry = storage.getAllEntries()[row.dataset.id];
        this.openSheet(entry);
      });
    });
  },

  renderRow(entry) {
    const time    = this.formatTime(entry.created_at);
    const preview = this.getPreview(entry);
    const unsaved = entry.editable
      ? '<span class="unsaved-dot" title="Not yet exported">●</span> '
      : '';

    return `
      <div class="entry-row card-row" data-id="${entry.id}">
        <div style="flex:1; min-width:0;">
          <div class="entry-row-meta">${time} ${unsaved}<span class="entry-row-type">${entry.type}</span></div>
          <div class="entry-row-body">${this.escapeHtml(preview)}</div>
        </div>
        <span class="entry-row-chevron">›</span>
      </div>
    `;
  },

  getPreview(entry) {
    switch (entry.type) {
      case 'note':        return entry.note        || '';
      case 'word':        return entry.word        || '';
      case 'quote':       return entry.quote       || '';
      case 'marginalium': return entry.marginalium || '';
      default:            return '';
    }
  },


  // --- Bottom sheet ---

  registerSheetHandlers() {
    document.getElementById('sheet-overlay').addEventListener('click', () => this.closeSheet());
    document.getElementById('sheet-close').addEventListener('click',   () => this.closeSheet());
  },

  openSheet(entry) {
    const canEdit = !!entry.editable;
    const schema  = SCHEMAS.entry_types[entry.type];
    const fields  = schema ? Object.keys(schema.fields) : [];

    // Build field rows in schema order, handling ref+page on same line
    let fieldsHtml = '';
    const shown    = new Set();
    const hasRef   = ['quote', 'marginalium'].includes(entry.type);

    fields.forEach(key => {
      if (shown.has(key)) return;

      if (hasRef && key === 'ref' && entry.ref) {
        const refLabel = refs.resolveRefLabel(entry.ref);
        fieldsHtml += this.refPageRow(refLabel, entry.page);
        shown.add('ref');
        shown.add('page');
        return;
      }

      if (key === 'page' && shown.has('page')) return;

      if (entry[key]) {
        fieldsHtml += `
          <div class="card-row" style="flex-direction:column; align-items:flex-start; gap:2px; padding:0.65rem var(--gap);">
            <span style="color:var(--muted); font-size:13px;">${key}</span>
            <span style="font-size:15px; white-space:pre-wrap; word-break:break-word;">${this.escapeHtml(String(entry[key]))}</span>
          </div>
        `;
        shown.add(key);
      }
    });

    document.getElementById('sheet-title').textContent =
      entry.type.charAt(0).toUpperCase() + entry.type.slice(1);

    document.getElementById('sheet-body').innerHTML = `
      <div style="font-size:12px; color:var(--muted); margin-bottom:0.75rem;">
        ${this.formatDateTime(entry.created_at)}
      </div>
      <div class="card" style="padding:0;">${fieldsHtml}</div>
    `;

    const footer    = document.getElementById('sheet-footer');
    const deleteBtn = document.getElementById('sheet-delete-btn');
    footer.style.display = canEdit ? 'block' : 'none';

    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    newDeleteBtn.addEventListener('click', () => {
      storage.deleteEntry(entry.id);
      showToast('Entry deleted');
      this.closeSheet();
      this.renderEntryList();
    });

    document.getElementById('sheet-overlay').style.display = 'block';
    document.getElementById('entry-sheet').style.display   = 'block';
  },

  closeSheet() {
    document.getElementById('sheet-overlay').style.display = 'none';
    document.getElementById('entry-sheet').style.display   = 'none';
  },

  // Render ref and page on same line
  refPageRow(refLabel, page) {
    const pageHtml = page ? `
      <div style="width:var(--page-width); flex-shrink:0; padding-left:var(--gap-sm);">
        <div style="color:var(--muted); font-size:13px;">page</div>
        <div style="font-size:15px;">${this.escapeHtml(String(page))}</div>
      </div>` : '';

    return `
      <div class="card-row" style="align-items:flex-start; padding:0.65rem var(--gap);">
        <div style="flex:1; min-width:0;">
          <div style="color:var(--muted); font-size:13px;">reference</div>
          <div style="font-size:15px; word-break:break-word;">${this.escapeHtml(String(refLabel))}</div>
        </div>
        ${pageHtml}
      </div>
    `;
  },


  // --- Helpers ---

  formatDayHeader(day) {
    const date = new Date(day + 'T12:00:00');
    return date.toLocaleDateString([], {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  },

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
      + ' · '
      + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

};
