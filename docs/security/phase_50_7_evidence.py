#!/usr/bin/env python3
"""Phase 50.7: offline independent-review evidence integrity checks.

This tool never grants approval, closes blockers, connects to Firebase, or deploys.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SHA = re.compile(r"^[a-f0-9]{40}$")
GATES = {f"G{i}" for i in range(1, 8)}
URL = re.compile(r"^https://github[.]com/[^/]+/[^/]+/actions/runs/[0-9]+$")
FORBIDDEN = ("private_key", "client_secret", "authorization: bearer", "-----begin private key-----")

def check(data):
    errors = []
    if not isinstance(data, dict) or data.get("environment") != "boustio-staging":
        errors.append("Environment must be isolated boustio-staging")
        return errors
    if data.get("independent_approval") is not False:
        errors.append("Independent approval must remain false")
    if data.get("deployment_enabled") is not False:
        errors.append("Deployment must remain disabled")
    if not isinstance(data.get("gates"), list):
        return errors + ["Missing gates list"]
    gates = data["gates"]
    ids = [g.get("gate") for g in gates if isinstance(g, dict)]
    if len(gates) != 7 or set(ids) != GATES or len(set(ids)) != 7:
        errors.append("Exactly seven distinct G1-G7 gates required")
    for g in gates:
        if not isinstance(g, dict):
            errors.append("Invalid gate record")
            continue
        gate = g.get("gate", "unknown")
        if g.get("status") != "PENDING":
            errors.append(f"{gate}: launch gate must remain PENDING")
        if g.get("environment") != "boustio-staging":
            errors.append(f"{gate}: environment mismatch")
        if g.get("reviewer") or g.get("reviewed_at"):
            errors.append(f"{gate}: reviewer sign-off cannot be asserted here")
        sha = g.get("commit_sha")
        if sha is not None and (not isinstance(sha, str) or not SHA.fullmatch(sha)):
            errors.append(f"{gate}: invalid commit SHA")
        evidence = g.get("evidence")
        if not isinstance(evidence, list):
            errors.append(f"{gate}: evidence must be a list")
            continue
        for record in evidence:
            if not isinstance(record, dict):
                errors.append(f"{gate}: invalid evidence record")
                continue
            if not {"run_url", "scenario", "expected", "actual", "recorded_at"}.issubset(record):
                errors.append(f"{gate}: evidence lacks required trace fields")
            if not isinstance(record.get("run_url"), str) or not URL.fullmatch(record["run_url"]):
                errors.append(f"{gate}: invalid GitHub Actions run URL")
            if any(not isinstance(record.get(k), str) or not record[k].strip() for k in ("scenario", "expected", "actual", "recorded_at")):
                errors.append(f"{gate}: empty trace field")
            raw = json.dumps(record).lower()
            if any(secret in raw for secret in FORBIDDEN):
                errors.append(f"{gate}: potential credential material in evidence")
    return errors

def main():
    path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "phase-50-6-evidence.json"
    errors = check(json.loads(path.read_text(encoding="utf-8")))
    if errors:
        print("FAIL CLOSED: " + "; ".join(errors))
        return 1
    print("PASS: offline evidence schema checked; seven blockers remain PENDING; independent review still required")
    return 0

if __name__ == "__main__":
    sys.exit(main())
