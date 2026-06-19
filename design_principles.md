# Commonplace Book — Design Principles

**1. The data repo is the commonplace book**
It contains three types of data: entries, sources, and tags. It is the single source of truth and the only permanent store.

**2. Data portability**
All entries and sources are plain text files, human-readable without any tool, now and in the future.

**3. The data repo is append-only**
Data can be changed only manually in GitHub. This is expected to be rare.

**4. The app's primary purpose: adding new entries**
New entries are saved to local storage on the device.

**5. The app's secondary purpose: browsing existing entries**
Entries are displayed exactly as entered, regardless of any schema changes since.

**6. The app works offline at all times**
It uses the internet only for export, import, and updates.

**7. Export and import are append-only**
Export pushes new local entries, sources, and tags to the data repo. Import pulls them into local storage. Neither modifies or deletes existing data.

**8. Editability**
An entry or source is editable and deletable in the app if and only if it has never been exported to or imported from the data repo.

**9. App updates**
The app updates automatically on each online refresh or reload.
