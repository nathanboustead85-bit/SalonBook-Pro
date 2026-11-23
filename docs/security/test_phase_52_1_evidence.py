import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent

class Phase52FailClosed(unittest.TestCase):
    def test_all_gates_open(self):
        evidence = json.loads((ROOT / "phase-52-1-evidence.json").read_text())
        self.assertEqual(evidence["project"], "boustio-staging")
        self.assertEqual(evidence["decision"], "NOT_APPROVED")
        self.assertEqual(set(evidence["gates"]), {f"G{i}" for i in range(1, 8)})
        for gate in evidence["gates"].values():
            self.assertEqual(gate["status"], "OPEN")
            self.assertIsNone(gate["independent_reviewer"])
            self.assertIsNone(gate["approved_at"])
            self.assertEqual(gate["evidence"], [])

    def test_no_live_changes(self):
        evidence = json.loads((ROOT / "phase-52-1-evidence.json").read_text())
        for field in ("deployment_enabled", "live_bookings_enabled", "payments_enabled", "messaging_enabled", "app_check_enforced"):
            self.assertIs(evidence[field], False)
        self.assertIs(evidence["original_android_appointments_preserved"], True)

if __name__ == "__main__":
    unittest.main()
