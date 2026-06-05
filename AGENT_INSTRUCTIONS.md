# Hisaab — Trader's Ledger

## 🤖 AI Agent Instructions

If you are an AI assistant or agent working on this codebase, **YOU MUST ADHERE TO THE FOLLOWING RULES:**

### 1. Progressive Web App (PWA) Cache Management
This application is a PWA that operates entirely offline using IndexedDB and a Service Worker (`sw.js`). Because the client devices aggressively cache the application files, **code changes will NOT propagate to the user's installed app unless the Service Worker cache is invalidated.**

**Rule:** Every single time you make a change to ANY code file (HTML, JS, CSS, JSON), you **MUST** open `sw.js` and increment the `CACHE_NAME` version.
*Example: Change `const CACHE_NAME = 'hisaab-cache-v1';` to `const CACHE_NAME = 'hisaab-cache-v2';`*

### 2. Architecture Constraints
- **No Backend:** Do not add backend servers, Node.js APIs, or external database calls. All data must be saved to IndexedDB via `js/db.js`.
- **Vanilla Tech Stack:** Use plain HTML, Vanilla JavaScript, and raw CSS. Do not introduce build steps, bundlers (like Webpack/Vite), or front-end frameworks (like React/Vue) unless specifically requested by the user.
- **Mobile-First:** Ensure all UI modifications use responsive design principles and look excellent on mobile devices.

### 3. Key Files
- `js/db.js` — Database schema, IndexedDB wrapper, and queries.
- `js/ui.js` — Reusable UI components (Modals, Sub-dialogs, Comboboxes, Line-Item Manager).
- `js/pages.js` — View layer; renders the HTML for different app tabs (Dashboard, Sales, Purchases, Reports, Masters).
- `js/app.js` — Main controller; handles routing, form submission logic, and orchestration.
- `js/pdf.js` — PDF generation logic using `jsPDF` and `jspdf-autotable`.
- `sw.js` — The Service Worker handling offline caching.
- `styles.css` — All application styling.

---

## 📱 Installation & Deployment (For the User)

Since this app stores all data locally on your device, it doesn't need a dedicated backend. 

### How to Install on Your Phone
1. **Host the app:** To install the app to your phone, it MUST be served over a secure `https://` connection.
   - *Temporary:* Run `python -m http.server 8000` and then `npx localtunnel --port 8000` to get a temporary secure link.
   - *Permanent (Recommended):* Drag and drop this entire project folder into [Netlify Drop](https://app.netlify.com/drop) to get a free, permanent secure URL.
2. **Install:** Open the secure URL on your phone's browser (Safari or Chrome). Tap the browser menu and select **"Add to Home Screen"** or **"Install App"**.

### PWA Auto-Updating
When you install the app on your phone, it saves the files for offline use. When you deploy new code changes, ensure the `CACHE_NAME` in `sw.js` has been bumped. 
To fetch the new update on your phone:
1. Open the app while connected to the internet.
2. The app will silently download the new update in the background.
3. Force-close the app and reopen it to apply the update.
