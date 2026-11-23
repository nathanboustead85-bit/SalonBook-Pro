import copy
import json
from pathlib import Path
import unittest
from phase_50_8_consolidate import consolidate

BASE = json.loads(Path(__file__).with_name("phase-50-6-evidence.json").read_text(encoding="utf-8"))

class ConsolidationTests(unittest.TestCase):
    def test_all_seven_blockers_open(self):
        result=consolidate(BASE)
        self.assertEqual(len(result["gates"]),7)
        self.assertTrue(all(g["launch_blocker"]=="OPEN" and not g["reviewer_signoff"] for g in result["gates"]))
    def test_no_authorization(self):
        result=consolidate(BASE)
        self.assertEqual(result["status"],"NOT_APPROVED")
        for k in ("deployment_authorized","live_bookings_authorized","payments_authorized","messaging_authorized"):
            self.assertFalse(result[k])
    def test_missing_gate_fails(self):
        x=copy.deepcopy(BASE); x["gates"].pop()
        with self.assertRaises(ValueError): consolidate(x)
    def test_false_approval_fails(self):
        x=copy.deepcopy(BASE); x["gates"][0]["status"]="APPROVED"
        with self.assertRaises(ValueError): consolidate(x)
    def test_enabled_feature_fails(self):
        x=copy.deepcopy(BASE); x["deployment_enabled"]=True
        with self.assertRaises(ValueError): consolidate(x)

if __name__=="__main__":
    unittest.main()
