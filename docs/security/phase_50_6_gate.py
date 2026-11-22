#!/usr/bin/env python3
"""Fail-closed, offline Boustio Phase 50.6 approval evidence validator."""
import json
import pathlib
import re
import sys

GATES = {f"G{i}" for i in range(1, 8)}
REQUIRED = {"gate", "status", "reviewer", "reviewed_at", "evidence", "commit_sha", "environment"}
SHA = re.compile(r"^[0-9a-f]{40}$")
SAFE_ENV = "boustio-staging"

def validate(document):
    errors = []
    if not isinstance(document, dict) or not isinstance(document.get("gates"), list):
        return ["Missing gates array"]
    seen = set()
    for item in document["gates"]:
        if not isinstance(item, dict):
            errors.append("Non-object gate")
            continue
        gate = item.get("gate")
        if gate in seen:
            errors.append(f"Duplicate gate: {gate}")
        seen.add(gate)
        if gate not in GATES:
            errors.append(f"Unknown gate: {gate}")
        if not REQUIRED.issubset(item):
            errors.append(f"{gate}: missing fields")
            continue
        if item["environment"] != SAFE_ENV:
            errors.append(f"{gate}: environment is not isolated staging")
        if item["status"] not in ("PENDING", "REJECTED", "APPROVED"):
            errors.append(f"{gate}: invalid status")
        if item["status"] == "APPROVED":
            if not item["reviewer"] or not item["reviewed_at"] or not item["evidence"]:
                errors.append(f"{gate}: approval without independent evidence")
            if not isinstance(item["commit_sha"], str) or not SHA.fullmatch(item["commit_sha"]):
                errors.append(f"{gate}: missing immutable commit SHA")
            # This phase is a preparation gate, never a deployment authorization.
            errors.append(f"{gate}: approval cannot be granted by Phase 50.6")
    if seen != GATES:
        errors.append("Exactly G1 through G7 must be present")
    if document.get("deployment_enabled") is not False:
        errors.append("Deployment must be disabled")
    for key in ("live_bookings_enabled", "payments_enabled", "messaging_enabled", "app_check_enforced"):
        if document.get(key) is not False:
            errors.append(f"{key} must be false")
    if document.get("independent_approval") is not False:
        errors.append("Independent approval must remain false")
    return errors

def main():
    path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).with_name("phase-50-6-evidence.json")
    errors = validate(json.loads(path.read_text(encoding="utf-8")))
    if errors:
        print("BLOCKED: " + "; ".join(errors))
        return 1
    print("PASS: seven pending staging gates validated; no approval or deployment authorized")
    return 0

if __name__ == "__main__":
    sys.exit(main())
