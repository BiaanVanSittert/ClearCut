# Privacy Notice

At ClearCut, we prioritize your privacy and data security by leveraging local, on-device processing. 

### Data Storage & Processing
1. **Local Processing Only:** All image editing, AI background removal, and file processing happen completely within your web browser. We do **not** upload your photos or sticker packs to any external servers.
2. **Local Storage:** When you create or edit projects, your data is saved locally on your device using the browser's `IndexedDB` and `localStorage` mechanisms. This ensures that your projects are preserved between sessions, but it also means that the data stays entirely under your control.

### How to Clear Your Data
Since your projects are stored in your browser, you can permanently delete them at any time:
- **Within the App:** Open the "Projects" menu and click the trash can icon next to any project to delete it.
- **Via the Browser:** You can wipe all ClearCut data by clearing your browser's site data (e.g., in Chrome: Settings > Privacy and security > Clear browsing data, or by using Developer Tools > Application > Clear storage).

### External Resources
ClearCut relies on WebAssembly (WASM) models provided by `@imgly/background-removal`. These are downloaded directly to your browser for local execution. No personal data or images are transmitted during this process.
