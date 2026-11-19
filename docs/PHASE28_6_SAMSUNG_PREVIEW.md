# Phase 28.6 — Viewable Samsung preview without deployment

The workflow generates a **single standalone HTML file** from the already-tested Phase 28.1 premium teal-and-white booking design. CSS and scripts are embedded so the file can open offline in a browser, with no Firebase configuration, external network, account, or hosted URL.

## Open on Samsung
1. Open the Phase 28.6 GitHub Actions workflow run.
2. Scroll to **Artifacts**, download **Boustio-Samsung-Website-Preview**.
3. Extract the ZIP using Samsung My Files.
4. Open `Boustio-Website-Preview.html` using a browser or HTML viewer. Some Samsung browser configurations restrict local file opening; use a browser that permits local HTML files if necessary.

The preview uses **fictional Kody Blends demo information**, not live salon data. Demo services, professional, dates and times can be selected; confirmation remains disabled. It is **not** a publicly hosted URL and **not** a real booking system. No production deployment, Firebase reads/writes, payments, messages, or real appointments are touched.

GitHub Actions artifacts can expire under repository retention settings. A later, separately approved preview hosting step may provide a normal HTTPS link.
