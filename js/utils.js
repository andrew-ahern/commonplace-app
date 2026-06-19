/* ============================================================
   utils.js
   Shared helper functions used across the app.
   Add new utilities here as needed.
   ============================================================ */


// Generate a unique entry ID based on Unix timestamp (milliseconds)
function generateEntryId() {
  return Date.now().toString();
}

// Generate a unique ref ID — prefixed with "ref_" for clarity
// Makes ref IDs unambiguous when embedded in entry objects
function generateRefId() {
  return `ref_${Date.now()}`;
}


// Return the current local time as an ISO 8601 string with timezone offset
// e.g. "2026-06-11T15:30:52+01:00" (local clock time, not UTC)
function currentTimestamp() {
  const now    = new Date();
  const offset = -now.getTimezoneOffset(); // offset in minutes (positive = ahead of UTC)
  const sign   = offset >= 0 ? '+' : '-';
  const pad    = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const hh     = pad(offset / 60);
  const mm     = pad(offset % 60);

  const Y  = now.getFullYear();
  const Mo = pad(now.getMonth() + 1);
  const D  = pad(now.getDate());
  const H  = pad(now.getHours());
  const Mi = pad(now.getMinutes());
  const S  = pad(now.getSeconds());

  return `${Y}-${Mo}-${D}T${H}:${Mi}:${S}${sign}${hh}:${mm}`;
}


// Show a brief toast notification at the bottom of the screen
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}
