import copy
import unittest
from phase_50_6_gate import validate
import json
from pathlib import Path

BASE = json.loads(Path(__file__).with_name("phase-50-6-evidence.json").read_text())

class ApprovalGateTests(unittest.TestCase):
    def test_pending_is_safe(self):
        self.assertEqual(validate(BASE), [])
    def test_missing_gate_fails(self):
        x=copy.deepcopy(BASE); x["gates"].pop()
        self.assertTrue(validate(x))
    def test_duplicate_gate_fails(self):
        x=copy.deepcopy(BASE); x["gates"][0]["gate"]="G2"
        self.assertTrue(validate(x))
    def test_unreviewed_approval_fails(self):
        x=copy.deepcopy(BASE); x["gates"][0]["status"]="APPROVED"
        self.assertTrue(validate(x))
    def test_forged_approval_fails_even_with_fields(self):
        x=copy.deepcopy(BASE); g=x["gates"][0]; g.update(status="APPROVED",reviewer="example",reviewed_at="2026-11-22",evidence=["fake"],commit_sha="a"*40)
        self.assertTrue(validate(x))
    def test_live_feature_fails(self):
        for key in ("deployment_enabled","live_bookings_enabled","payments_enabled","messaging_enabled","app_check_enforced","independent_approval"):
            x=copy.deepcopy(BASE); x[key]=True
            with self.subTest(key=key): self.assertTrue(validate(x))
    def test_wrong_environment_fails(self):
        x=copy.deepcopy(BASE); x["gates"][0]["environment"]="production"
        self.assertTrue(validate(x))

if __name__ == "__main__":
    unittest.main()
