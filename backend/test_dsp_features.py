import unittest

import numpy as np

from dsp_features import compute_artifact_metrics, spectral_features, wavelet_features


class DSPFeatureTests(unittest.TestCase):
    def setUp(self):
        self.fs = 200.0
        self.time = np.arange(0, 10, 1 / self.fs)

    def test_ten_hz_signal_is_alpha_dominant(self):
        features = spectral_features(np.sin(2 * np.pi * 10 * self.time), self.fs)
        powers = {band: features[band] for band in ("Delta", "Theta", "Alpha", "Beta", "Gamma")}

        self.assertEqual(max(powers, key=powers.get), "Alpha")
        self.assertAlmostEqual(features["DominantFreqFull"], 10.0, delta=0.5)

    def test_two_hz_signal_is_delta_dominant(self):
        features = spectral_features(np.sin(2 * np.pi * 2 * self.time), self.fs)
        self.assertGreater(features["Delta"], features["Alpha"])
        self.assertAlmostEqual(features["DominantFreqFull"], 2.0, delta=0.5)

    def test_report_compatible_ocular_threshold(self):
        f8 = np.zeros(1000)
        f8[500] = 25.0
        metrics = compute_artifact_metrics({"F8": f8, "T7": np.ones(1000)}, self.fs)
        self.assertTrue(metrics["ocular_detected"])

    @unittest.skipIf(__import__("dsp_features").pywt is None, "PyWavelets is not installed")
    def test_wavelet_energy_is_finite_and_positive(self):
        features = wavelet_features(np.sin(2 * np.pi * 10 * self.time))
        self.assertTrue(np.isfinite(features["WaveletEnergy"]))
        self.assertGreater(features["WaveletEnergy"], 0)


if __name__ == "__main__":
    unittest.main()
