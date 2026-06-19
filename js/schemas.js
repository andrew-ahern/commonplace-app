/* ============================================================
   schemas.js
   Defines all entry and ref type schemas.
   All other modules query schemas through functions added here
   as needed. Nothing else accesses SCHEMAS directly.
   To add a new type, add it to the relevant section below.

   Entry core fields (added automatically, not in schema):
     id           — Unix timestamp string, e.g. "1749123456789"
     created_at   — local ISO 8601 timestamp with offset
     type         — entry type name
     editable     — true until exported to or imported from data repo

   Ref core fields (added automatically, not in schema):
     id           — prefixed Unix timestamp, e.g. "ref_1749123456789"
     created_at   — local ISO 8601 timestamp with offset
     type         — ref type name
     editable     — true until exported to or imported from data repo

   Ref field on quote/marginalium entries:
     ref          — either a ref_ ID string (saved ref)
                    or an inline ref object (unsaved structured ref)
   ============================================================ */


const SCHEMAS = {

  // ----------------------------------------------------------
  // Entry types
  // ----------------------------------------------------------

  entry_types: {

    note: {
      fields: {
        heading:     { required: false },
        note:        { required: true  },
        tags:        { required: false },
      }
    },

    quote: {
      fields: {
        quote:       { required: true  },
        ref:         { required: false },
        page:        { required: false },
        comment:     { required: false },
        tags:        { required: false },
      }
    },

    marginalium: {
      fields: {
        heading:     { required: false },
        marginalium: { required: true  },
        ref:         { required: false },
        page:        { required: false },
        tags:        { required: false },
      }
    },

    word: {
      fields: {
        word:        { required: true  },
        comment:     { required: false },
      }
    },

  },


  // ----------------------------------------------------------
  // Ref types
  // Grouped by category for display purposes.
  // source_id / source_text on work types point to a book ref
  // or freeform description of the containing publication.
  // ----------------------------------------------------------

  ref_types: {

    // --- Books and long-form works ---

    book: {
      label: 'Book',
      fields: {
        title:       { required: true  },
        author:      { required: true  },
        publisher:   { required: false },
        year:        { required: false },
        edition:     { required: false },
      }
    },

    novel: {
      label: 'Novel',
      fields: {
        title:       { required: true  },
        author:      { required: true  },
        source_id:   { required: false },
        source_text: { required: false },
      }
    },

    novella: {
      label: 'Novella',
      fields: {
        title:       { required: true  },
        author:      { required: true  },
        source_id:   { required: false },
        source_text: { required: false },
      }
    },

    // --- Short works (may appear within a book/collection) ---

    short_story: {
      label: 'Short story',
      fields: {
        title:       { required: true  },
        author:      { required: true  },
        source_id:   { required: false },
        source_text: { required: false },
      }
    },

    poem: {
      label: 'Poem',
      fields: {
        title:       { required: true  },
        author:      { required: true  },
        source_id:   { required: false },
        source_text: { required: false },
      }
    },

    play: {
      label: 'Play',
      fields: {
        title:       { required: true  },
        author:      { required: true  },
        source_id:   { required: false },
        source_text: { required: false },
      }
    },

    essay: {
      label: 'Essay',
      fields: {
        title:       { required: true  },
        author:      { required: true  },
        source_id:   { required: false },
        source_text: { required: false },
      }
    },

    // --- Academic and journalism ---

    journal_article: {
      label: 'Journal article',
      fields: {
        title:       { required: true  },
        author:      { required: true  },
        journal:     { required: true  },
        year:        { required: true  },
        volume:      { required: false },
        issue:       { required: false },
        pages:       { required: false },
        doi:         { required: false },
      }
    },

    article: {
      label: 'Article',
      fields: {
        title:       { required: true  },
        author:      { required: false },
        publication: { required: true  },
        date:        { required: false },
      }
    },

    // --- Audio and visual ---

    speech: {
      label: 'Speech',
      fields: {
        speaker:     { required: true  },
        date:        { required: true  },
        title:       { required: false },
        location:    { required: false },
        occasion:    { required: false },
        source_id:   { required: false },
        source_text: { required: false },
      }
    },

    broadcast: {
      label: 'Broadcast',
      fields: {
        title:       { required: true  },
        subtitle:    { required: false },
        broadcaster: { required: false },
        date:        { required: false },
      }
    },

    film: {
      label: 'Film',
      fields: {
        title:       { required: true  },
        director:    { required: true  },
        studio:      { required: false },
        year:        { required: false },
      }
    },

    // --- Catch-all ---

    other: {
      label: 'Other',
      fields: {
        title:       { required: true  },
        author:      { required: false },
        date:        { required: false },
        comment:     { required: false },
      }
    },

  },

};
