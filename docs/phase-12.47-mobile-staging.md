# Phase 12.47 — Mobile staging demo

The static page `web/phase1247/index.html` is a self-contained interactive premium teal demonstration using **fictional services, prices, dates and slots**. No Firebase SDK, network calls, booking writes, payments, customer data, or production credentials. It is intentionally distinct from Phase 12.46's emulator-backed preview. The site explicitly says DEMO and NOT BOOKED.

The workflow on `main` checks out `milestone-customer-booking-experience`, runs static safety tests and readiness gate tests, then publishes **only** three files (HTML, robots.txt and .nojekyll) to GitHub Pages. It does not deploy the app, backend, Firebase rules, or cloud functions.

If GitHub Pages is not enabled, the owner must open repository Settings → Pages and select **GitHub Actions** as the build/deployment source. Then rerun the workflow. The site should appear at the URL returned by the successful GitHub Pages deployment (typically the repository Pages path); verify the actual deployment before sharing the link. This is a publicly reachable demo, not a private test site. Do not configure boustio.co.uk or a custom domain for this demo. Original two appointments remain untouched.
