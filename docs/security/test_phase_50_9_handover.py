import copy
import json
from pathlib import Path
import unittest
from phase_50_9_handover import validate
BASE=json.loads(Path(__file__).with_name("phase-50-9-handover.json").read_text(encoding="utf-8"))

class HandoverTests(unittest.TestCase):
    def test_safe_handover(self): self.assertEqual(validate(BASE),[])
    def test_cannot_merge(self):
        x=copy.deepcopy(BASE); x["merge_authorized"]=True
        self.assertTrue(validate(x))
    def test_cannot_deploy(self):
        x=copy.deepcopy(BASE); x["deployment_authorized"]=True
        self.assertTrue(validate(x))
    def test_cannot_close_gate(self):
        x=copy.deepcopy(BASE); x["gates"][0]["blocker"]="CLOSED"
        self.assertTrue(validate(x))
    def test_cannot_forge_review(self):
        x=copy.deepcopy(BASE); x["gates"][0]["reviewer"]="example"
        self.assertTrue(validate(x))
    def test_cannot_enable_app_check(self):
        x=copy.deepcopy(BASE); x["app_check_enforcement_authorized"]=True
        self.assertTrue(validate(x))
    def test_cannot_remove_gate(self):
        x=copy.deepcopy(BASE); x["gates"].pop()
        self.assertTrue(validate(x))

if __name__=="__main__": unittest.main()
