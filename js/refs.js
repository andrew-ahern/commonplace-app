/* ============================================================
   refs.js
   Creates, validates, and labels ref objects.
   Mirrors entries.js in structure.
   Does not read or write to storage — that is storage.js's job.
   ============================================================ */


const refs = {

  // Build a complete ref object from a type and form data
  // Adds id (ref_ prefixed), created_at, type, and editable automatically
  createRef(type, data) {
    return {
      id:         generateRefId(),
      created_at: currentTimestamp(),
      editable:   true,
      type,
      ...data,
    };
  },

  // Validate a ref against its type schema
  // Returns { valid: true } or { valid: false, errors: [...] }
  validateRef(ref) {
    const schema = SCHEMAS.ref_types[ref.type];
    if (!schema) {
      return { valid: false, errors: [`Unknown ref type: ${ref.type}`] };
    }

    const errors = [];

    for (const [field, rules] of Object.entries(schema.fields)) {
      if (rules.required && !ref[field]) {
        errors.push(`"${field}" is required`);
      }
    }

    return errors.length ? { valid: false, errors } : { valid: true };
  },

  // Return a human-readable label for a ref (for display in dropdowns)
  // Adapts to each ref type's primary identifying fields
  getLabel(ref) {
    if (!ref) return '';
    switch (ref.type) {
      case 'book':
      case 'novel':
      case 'novella':
      case 'short_story':
      case 'poem':
      case 'play':
      case 'essay':
        return [ref.title, ref.author].filter(Boolean).join(' — ');

      case 'journal_article':
      case 'article':
        return [ref.title, ref.author].filter(Boolean).join(' — ');

      case 'speech':
        return [ref.speaker, ref.title, ref.date].filter(Boolean).join(' — ');

      case 'broadcast':
        return [ref.title, ref.subtitle, ref.broadcaster].filter(Boolean).join(' — ');

      case 'film':
        return [ref.title, ref.director, ref.year].filter(Boolean).join(' — ');

      case 'other':
        return [ref.title, ref.author].filter(Boolean).join(' — ');

      default:
        return ref.title || ref.id;
    }
  },

  // Return the label for the ref field on an entry
  // ref can be a string ID (saved ref) or an inline object (unsaved ref)
  resolveRefLabel(ref) {
    if (!ref) return '';
    if (typeof ref === 'string') {
      // It's a ref_id — look up in storage
      const saved = storage.getAllRefs()[ref];
      return saved ? this.getLabel(saved) : ref;
    }
    // It's an inline ref object
    return this.getLabel(ref);
  },

};
