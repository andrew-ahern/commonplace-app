/* ============================================================
   app.js
   Entry point. Initialises the app and handles screen routing.
   Runs after all other scripts have loaded.
   ============================================================ */


// Initialise the app once the page has fully loaded
document.addEventListener('DOMContentLoaded', () => {
  uiNewEntry.init();
  uiBrowse.init();
  uiSettings.init();
  showScreen('new-entry');
  registerServiceWorker();
});

// Register service worker for offline support and PWA installation
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js')
    .then(reg => {
      // Check for updates on each load
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available — show update toast
            showUpdateToast();
          }
        });
      });
    })
    .catch(err => console.error('Service worker registration failed:', err));
}

// Show a persistent toast when an app update is available
function showUpdateToast() {
  const toast = document.getElementById('toast');
  toast.textContent = 'Update available — refresh to apply';
  toast.style.cursor = 'pointer';
  toast.classList.add('show');
  toast.onclick = () => {
    navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
    location.reload();
  };
}


// Handle nav button clicks — switch active screen
document.getElementById('nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-btn');
  if (!btn) return;

  const screen = btn.dataset.screen;

  // Update active nav button
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  showScreen(screen);

  // Refresh entry list when Browse is opened
  if (screen === 'browse') {
    uiBrowse.renderEntryList();
  }
});


// Show a screen by id, hide all others
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.toggle('active', screen.id === `screen-${screenId}`);
  });
}
