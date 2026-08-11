# ClearCut Recommendations

This document summarizes missing items, security/privacy concerns, and code quality issues discovered during the ClearCut review. Each entry includes a technical description, the issue discovered, and a recommended goal or resolution.

## 1. Missing License / Legal Documentation

- Technical description: The repository has no `LICENSE` file, and the app contains no EULA or terms of use documentation.
- Issue: Without a license or legal notice, users and contributors cannot reliably understand usage rights or distribution terms.
- Goal: Add an explicit open-source license or distribution license file, and document third-party dependency terms.
- Resolution:
  - Create `LICENSE` with the chosen license text.
  - Add a short `TERMS.md` or `LICENSE.md` if needed for custom distribution terms.
  - Document licensing for `@imgly/background-removal`, `@techstark/opencv-js`, `canvas`, `puppeteer`, and any other third-party dependencies.

## 2. Missing Privacy Notice

- Technical description: The app stores data locally in `localStorage` and IndexedDB, and the UI claims client-side processing.
- Issue: There is no privacy notice explaining what data is stored, how long it persists, and what external resources are loaded.
- Goal: Add a privacy notice describing local storage behavior and external requests.
- Resolution:
  - Create a `PRIVACY.md` or add a privacy section to `README.md`.
  - Explain that projects are saved in browser storage and can persist until deleted.
  - Disclose the remote Google Fonts request from `src/index.css`.

## 3. Remote Resource / Privacy Leakage via Google Fonts

- Technical description: `src/index.css` imports fonts from `https://fonts.googleapis.com`.
- Issue: This external call exposes user IP and request metadata to Google, conflicting with the app's privacy-first messaging.
- Goal: Remove or self-host remote font resources.
- Resolution:
  - Replace the `@import` with a locally hosted font file package.
  - Alternatively use system fonts or bundle font assets with the app.

## 4. Missing Content Security Policy (CSP)

- Technical description: `index.html` has no CSP meta tag or header for script/style restrictions.
- Issue: Without CSP, the app is more vulnerable to injected script or stylesheet attacks if content is loaded from untrusted sources.
- Goal: Add a CSP policy to harden browser security.
- Resolution:
  - Add a meta CSP to `index.html` such as `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;`.
  - Adjust policies as needed for local blob URLs and WASM assets.

## 5. Inappropriate Production Dependencies

- Technical description: `package.json` lists `canvas` and `puppeteer` under `dependencies`.
- Issue: These packages are server-side/node libraries and likely not needed in the browser runtime, increasing install size and potential attack surface.
- Goal: Remove or relocate non-browser dependencies.
- Resolution:
  - Audit code for server-side usage.
  - Move `canvas` and `puppeteer` to `devDependencies` if used only for tooling.
  - Remove them entirely if unused.

## 6. Unsafe `Workspace` Project Load Behavior

- Technical description: `App.tsx` loads saved projects using `new File([], 'image.png')` when the original `File` object is unavailable.
- Issue: `segmentForeground(originalFile, ...)` and other file-based operations may fail or produce invalid results when given an empty placeholder file.
- Goal: Preserve actual image data for reopened projects or avoid empty placeholder files.
- Resolution:
  - Store the raw image blob in project state and reconstruct a valid `File` before passing to `Workspace`.
  - If the app cannot recreate a `File`, refactor `Workspace` to accept the image URL only for saved projects.

## 7. Memory Leak Risk from Unrevoke Object URLs

- Technical description: `projectStorage.ts`, `ProjectsModal.tsx`, and `StickerWorkspace.tsx` call `URL.createObjectURL(...)` without ever revoking the object URLs.
- Issue: Browser memory can accumulate over time, especially when loading many saved projects or sticker previews.
- Goal: Revoke temporary object URLs when they are no longer needed.
- Resolution:
  - Track object URLs created from blobs and call `URL.revokeObjectURL(url)` after the resource is released.
  - Clean up revoked URLs when components unmount or new data is loaded.

## 8. Weak Type Definitions for Project Storage

- Technical description: `ProjectData` uses `stickers?: any[]` and general string fields for saved URLs.
- Issue: Loose typing hides structural expectations and makes maintenance harder.
- Goal: Strengthen TypeScript types for project data and stickers.
- Resolution:
  - Define explicit interfaces for sticker objects and saved project schema.
  - Avoid `any[]` by declaring sticker list types and optional fields explicitly.

## 9. Incomplete Restore Tool Logic in `Workspace.tsx`

- Technical description: The restore tool contains commented or uncertain logic and fallback behavior for clipping and drawing the original image.
- Issue: The restore feature may not behave reliably and is a maintenance liability.
- Goal: Clean up and verify restore behavior or simplify the implementation.
- Resolution:
  - Replace the current approximate restore logic with a deterministic restoration path.
  - Use an offscreen canvas or mask to restore pixels precisely from the original image.
  - Remove dead/commented code and document the algorithm.

## 10. `error_server.js` Security Issue

- Technical description: `error_server.js` opens an HTTP server on port 3000 with `Access-Control-Allow-Origin: '*'`.
- Issue: This is insecure if used in a production or shared environment.
- Goal: Remove or restrict this server to development-only use.
- Resolution:
  - Delete the file if unused.
  - If it is required for local debugging, add a warning and restrict CORS to trusted origins.

## 11. No License or Legal Attribution for Third-Party Services

- Technical description: README claims local processing but does not document dependency licenses or compliance.
- Issue: Users and auditors cannot verify whether ClearCut is compliant with library terms, especially for `@imgly/background-removal`.
- Goal: Add third-party attribution and dependency compliance details.
- Resolution:
  - Add a `THIRD_PARTY.md` or section in `README.md` listing major libraries and their licenses.
  - Note any service or model usage restrictions.

## 12. No Explicit User-Controlled Data Deletion Guidance

- Technical description: Projects are stored locally, with delete controls only inside the app modal.
- Issue: Users may not know how to remove persisted project data from the browser if the app is uninstalled.
- Goal: Document how to clear stored data and offer explicit privacy controls.
- Resolution:
  - Add a section in `README.md` or `PRIVACY.md` describing browser storage deletion and IndexedDB clearing.
  - Optionally add an in-app “clear all data” button and a privacy/help tooltip.

## 13. Potential Runtime Failure for `fetch(url)` on Blob URLs

- Technical description: `StickerWorkspace.tsx` and `projectStorage.ts` use `fetch(url)` on local blob URLs during export and saving.
- Issue: If blob URLs expire or are revoked earlier, `fetch` can fail unexpectedly.
- Goal: Use direct Blob data or ensure object URL lifetime is valid.
- Resolution:
  - Preserve the underlying blob data when saving sticker state.
  - Use stored `Blob` objects directly instead of relying on `fetch` from object URLs.

## 14. Missing Tests or Verification Steps

- Technical description: The project includes no automated tests or validation scripts.
- Issue: Regression and correctness issues are harder to catch over time.
- Goal: Add targeted tests for storage, image loading, and key interaction paths.
- Resolution:
  - Add a test harness or at least one Cypress/Playwright smoke test for upload/project load.
  - Add linting or TypeScript checks if not already enforced on CI.

---

These recommendations are intended to make ClearCut more secure, privacy-conscious, maintainable, and legally sound. If you want, I can also turn this into a prioritized implementation plan or create a second file with patch-by-patch fixes.