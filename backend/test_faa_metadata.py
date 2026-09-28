import unittest

import numpy as np

from faa_metadata import build_faa_details


class FAAMetadataTests(unittest.TestCase):
    def setUp(self):
        self.sampling_rate = 200.0
        self.time = np.arange(0, 10, 1 / self.sampling_rate)

    def test_standard_f3_f4_pair_is_preferred(self):
        signals = {
            "F3": np.sin(2 * np.pi * 10 * self.time),
            "F4": 2 * np.sin(2 * np.pi * 10 * self.time),
            "T7": np.sin(2 * np.pi * 10 * self.time),
            "F8": np.sin(2 * np.pi * 10 * self.time),
        }
        details = build_faa_details(signals, self.sampling_rate, legacy_score=0.5)

        self.assertEqual(details["pair_used"], ["F3", "F4"])
        self.assertTrue(details["standard_frontal_pair"])
        self.assertAlmostEqual(details["legacy_score"], 0.5)
        self.assertAlmostEqual(details["corrected_unscaled_score"], np.log(4), delta=0.05)

    def test_t7_f8_pair_remains_available_as_report_fallback(self):
        signals = {
            "T7": np.sin(2 * np.pi * 10 * self.time),
            "F8": np.sin(2 * np.pi * 10 * self.time),
        }
        details = build_faa_details(signals, self.sampling_rate, legacy_score=0.1)

        self.assertEqual(details["mode"], "fallback_two_channel")
        self.assertFalse(details["standard_frontal_pair"])

    def test_zero_filled_missing_f3_f4_channels_do_not_override_fallback(self):
        signals = {
            "F3": np.zeros_like(self.time),
            "F4": np.zeros_like(self.time),
            "T7": np.sin(2 * np.pi * 10 * self.time),
            "F8": np.sin(2 * np.pi * 10 * self.time),
        }
        details = build_faa_details(signals, self.sampling_rate, legacy_score=0.0)

        self.assertEqual(details["pair_used"], ["T7", "F8"])


if __name__ == "__main__":
    unittest.main()
