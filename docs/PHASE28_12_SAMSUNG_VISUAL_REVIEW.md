# Phase 28.12 — Samsung visual review pack

This phase **does not change the booking website**. It builds the exact existing Phase 28.11 offline HTML from the repository and captures six full-page screenshots with Playwright Chromium:
- Samsung 360px: landing and completed demo review
- Samsung 390px: landing and completed demo review
- Desktop 1280px: landing and completed demo review

The screenshot runner checks no horizontal overflow, a permanently disabled confirmation button, all four selection steps, and zero external requests. GitHub Actions also reruns all 37 browser regression checks and uploads the HTML, screenshots and a README as a single downloadable artifact ZIP.

## Samsung instructions

1. Open the workflow run under **Actions** on GitHub in your phone browser.
2. Scroll to **Artifacts**, tap **Boustio-Phase28-12-Samsung-Visual-Review**. If the GitHub app does not download it, open the same page in Samsung Internet or Chrome, sign in and enable **Desktop site**.
3. Open the downloaded ZIP in **My Files**, extract it, then open the PNG screenshots. The HTML is a self-contained offline interactive preview; opening local HTML may require a browser or HTML viewer that supports local files.
4. Compare the service cards, header, staff selection, customer details, and final review to the approved premium teal-and-white design.

Artifacts are accessible only according to the repository's GitHub access settings; they are not a public website or live preview URL. No Firebase changes, live bookings, payments, messaging, deployments or changes to existing appointments.
