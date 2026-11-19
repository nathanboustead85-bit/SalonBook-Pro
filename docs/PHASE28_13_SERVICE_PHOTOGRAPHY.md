# Phase 28.13 — service photography concept

Opt-in **photo-preview.html** shows illustrative third-party Unsplash photos for the three fictional Kody Blends services, with responsive crop, labels, pricing, and image-error fallback. Images require internet connectivity and are **not business-owned photographs**; verify licensing and replace with licensed salon uploads before any launch. Opening the photo preview makes requests to images.unsplash.com; no customer data is transmitted by Boustio, and this is not the offline preview.

The existing index.html offline website remains unchanged in its visual presentation. The optional photo preview shares the selection logic and retains the disabled booking button. No upload UI, cloud storage, Firebase writes, or deployment is added. Actual business uploads require separate storage authorization, resizing, moderation, quotas and cost controls.

The workflow tests the opt-in image display using mocked network images, reruns the existing premium preview tests, and uploads a self-contained code package **except for the remotely hosted photographs**. For mobile review, GitHub Actions artifacts may be inconvenient; the assistant can retrieve the artifact for direct file sharing. Do not enter real personal data.
