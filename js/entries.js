/* ============================================================
   entries.js
   Creates and validates entry objects.
   Does not read or write to storage — that is storage.js's job.
   ============================================================ */


const entries = {

  // Build a complete entry object from a type and form data
  // Adds id, created_at, type, and editable automatically
  createEntry(type, data) {
    return {
      id:       generateEntryId(),
      created_at: currentTimestamp(),
      editable: true,
      type,
      ...data,
    };
  },

  // Validate an entry against its type schema
  // Returns { valid: true } or { valid: false, errors: [...] }
  validateEntry(entry) {
    const schema = SCHEMAS.entry_types[entry.type];
    if (!schema) {
      return { valid: false, errors: [`Unknown entry type: ${entry.type}`] };
    }

    const errors = [];

    for (const [field, rules] of Object.entries(schema.fields)) {
      if (rules.required && !entry[field]) {
        errors.push(`"${field}" is required`);
      }
    }

    // ref is required for quote and marginalium
    if (['quote', 'marginalium'].includes(entry.type) && !entry.ref) {
      errors.push('A reference is required');
    }

    return errors.length ? { valid: false, errors } : { valid: true };
  },

};
