# Phase 60.4 — Native visual refinements

- Android system bar insets are applied to the root view on API 30+, avoiding bottom navigation overlap with the Samsung system navigation bar. Earlier API versions use fitsSystemWindows.
- Four bottom navigation text symbols are replaced by native vector icons.
- The temporary white letter B is replaced with a locally authored, stylized Boustio mark vector using dark green, white and lime. **This is a recreation, not the original exact brand artwork**; confirm against the approved reference screenshot on Samsung.
- No booking storage or business logic is modified. All live booking, payment, messaging and deployment features remain disabled, and all G1–G7 launch gates stay open.
- The workflow builds only the separate `com.salonbook.pro.isolated` offline APK. Do not uninstall or clear Boustio DEV 11.13 or its two original appointments.
