import copy
import json
from pathlib import Path
import unittest
from phase_50_7_evidence import check

BASE=json.loads(Path(__file__).with_name("phase-50-6-evidence.json").read_text(encoding="utf-8"))

class EvidenceIntegrityTests(unittest.TestCase):
    def test_pending_register_passes(self):
        self.assertEqual(check(BASE), [])
    def test_approved_gate_fails(self):
        x=copy.deepcopy(BASE); x["gates"][0]["status"]="APPROVED"
        self.assertTrue(check(x))
    def test_wrong_project_fails(self):
        x=copy.deepcopy(BASE); x["environment"]="production"
        self.assertTrue(check(x))
    def test_missing_gate_fails(self):
        x=copy.deepcopy(BASE); x["gates"].pop()
        self.assertTrue(check(x))
    def test_unverified_reviewer_claim_fails(self):
        x=copy.deepcopy(BASE); x["gates"][0]["reviewer"]="someone"
        self.assertTrue(check(x))
    def test_invalid_run_link_fails(self):
        x=copy.deepcopy(BASE); x["gates"][0]["evidence"]=[dict(run_url="https://example.com",scenario="test",expected="deny",actual="deny",recorded_at="2026-11-22")]
        self.assertTrue(check(x))
    def test_missing_trace_field_fails(self):
        x=copy.deepcopy(BASE); x["gates"][0]["evidence"]=[dict(run_url="https://github.com/a/b/actions/runs/123",scenario="test",expected="deny",actual="deny")]
        self.assertTrue(check(x))
    def test_secret_marker_fails(self):
        x=copy.deepcopy(BASE); x["gates"][0]["evidence"]=[dict(run_url="https://github.com/a/b/actions/runs/123",scenario="test",expected="deny",actual="deny",recorded_at="2026-11-22",notes="private_key")]
        self.assertTrue(check(x))

if __name__=="__main__":
    unittest.main()
