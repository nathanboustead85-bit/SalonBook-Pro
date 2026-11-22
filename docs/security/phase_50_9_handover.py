#!/usr/bin/env python3
"""Phase 50.9 offline handover guard: never authorizes deployment."""
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
def validate(data):
    errors=[]
    if data.get("phase")!="50.9" or data.get("environment")!="boustio-staging":
        errors.append("Wrong phase/environment")
    if data.get("decision")!="NOT_APPROVED" or data.get("independent_review_required") is not True:
        errors.append("Independent review must remain pending")
    for field in ("merge_authorized","deployment_authorized","live_bookings_authorized","payments_authorized","messaging_authorized","app_check_enforcement_authorized"):
        if data.get(field) is not False:
            errors.append(field+" must be false")
    if data.get("original_android_appointments")!="DO_NOT_ACCESS_OR_MODIFY":
        errors.append("Original Android appointment protection missing")
    gates=data.get("gates")
    if not isinstance(gates,list) or len(gates)!=7 or {g.get("id") for g in gates if isinstance(g,dict)}!={f"G{i}" for i in range(1,8)}:
        errors.append("Exactly seven G1-G7 gates required")
    else:
        for gate in gates:
            if gate.get("blocker")!="OPEN" or gate.get("review")!="PENDING" or gate.get("evidence_verified") is not False or gate.get("reviewer") is not None or gate.get("review_date") is not None:
                errors.append(gate["id"]+": premature closure or approval")
            if not isinstance(gate.get("findings"),list):
                errors.append(gate["id"]+": findings list missing")
    if not isinstance(data.get("handover_requirements"),list) or len(data["handover_requirements"])<7:
        errors.append("Handover requirements missing")
    return errors

if __name__=="__main__":
    p=Path(sys.argv[1]) if len(sys.argv)>1 else HERE/"phase-50-9-handover.json"
    errors=validate(json.loads(p.read_text(encoding="utf-8")))
    if errors:
        print("FAIL CLOSED: "+"; ".join(errors))
        sys.exit(1)
    print("PASS: handover prepared; all seven blockers OPEN; independent review outstanding")
