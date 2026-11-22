#!/usr/bin/env python3
"""Phase 50.8: deterministic offline security evidence consolidation; no approvals."""
import json
from pathlib import Path
import sys
from phase_50_6_gate import validate as gate_validate
from phase_50_7_evidence import check as evidence_check

HERE = Path(__file__).resolve().parent
INPUT = HERE / "phase-50-6-evidence.json"
OUTPUT = HERE / "phase-50-8-review-package.json"
TOPICS = {
    "G1": "Staging isolation and least-privilege IAM",
    "G2": "Authentication and revoked-token behavior",
    "G3": "Firestore cross-owner isolation",
    "G4": "App Check test-only key and enforcement readiness",
    "G5": "Booking concurrency and idempotency",
    "G6": "Messaging, attachment and payment restrictions",
    "G7": "Credential scans, logging, rollback and release controls",
}

def consolidate(register):
    errors = gate_validate(register) + evidence_check(register)
    if errors:
        raise ValueError("; ".join(errors))
    gates = []
    for gate in sorted(register["gates"], key=lambda g: g["gate"]):
        key = gate["gate"]
        gates.append({
            "gate": key,
            "topic": TOPICS[key],
            "launch_blocker": "OPEN",
            "independent_verification": "PENDING",
            "evidence_records": len(gate["evidence"]),
            "automated_evidence_verified": False,
            "reviewer_signoff": False,
        })
    return {
        "phase": "50.8",
        "environment": "boustio-staging",
        "status": "NOT_APPROVED",
        "deployment_authorized": False,
        "live_bookings_authorized": False,
        "payments_authorized": False,
        "messaging_authorized": False,
        "original_android_appointments": "DO_NOT_ACCESS_OR_MODIFY",
        "note": "Offline register validation only; actual GitHub runs and Firebase configuration have not been independently verified.",
        "gates": gates,
    }

def main():
    register = json.loads(INPUT.read_text(encoding="utf-8"))
    package = consolidate(register)
    rendered = json.dumps(package, indent=2, sort_keys=True) + "\n"
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != rendered:
            print("FAIL: consolidated package is missing or out of sync")
            return 1
        print("PASS: package synchronized; 7 launch blockers OPEN; deployment NOT APPROVED")
        return 0
    OUTPUT.write_text(rendered, encoding="utf-8")
    print("Wrote offline pending-review package")
    return 0

if __name__ == "__main__":
    sys.exit(main())
