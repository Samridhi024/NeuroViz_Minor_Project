import json
import unittest

from channel_mapping import ChannelMappingRequired, resolve_channel_mapping


class ChannelMappingTests(unittest.TestCase):
    def test_explicit_labels_work_in_any_order(self):
        columns = ["Timestamp", "EEG F8-REF", "P4", "EEG T7-REF", "Cz"]
        result = resolve_channel_mapping(columns, "recording.csv")

        self.assertEqual(result.channels["T7"], "EEG T7-REF")
        self.assertEqual(result.channels["F8"], "EEG F8-REF")
        self.assertEqual(result.source, "column_labels")

    def test_legacy_t3_alias_is_supported(self):
        result = resolve_channel_mapping(["EEG T3", "EEG F8"], "legacy.csv")
        self.assertEqual(result.channels["T7"], "EEG T3")

    def test_physionet_auditory_profile_uses_documented_order(self):
        columns = ["Sample Index"] + [f" EXG Channel {index}" for index in range(4)]
        result = resolve_channel_mapping(columns, "s04_ex01_s03.txt")

        self.assertEqual(result.channels["P4"], " EXG Channel 0")
        self.assertEqual(result.channels["Cz"], " EXG Channel 1")
        self.assertEqual(result.channels["F8"], " EXG Channel 2")
        self.assertEqual(result.channels["T7"], " EXG Channel 3")
        self.assertEqual(result.profile, "physionet_auditory_eeg_v1")

    def test_unknown_generic_columns_require_confirmation(self):
        with self.assertRaises(ChannelMappingRequired):
            resolve_channel_mapping(
                ["Time", "EXG Channel 0", "EXG Channel 1"],
                "unknown_recording.csv",
            )

    def test_manual_mapping_is_honored(self):
        columns = ["EXG Channel 0", "EXG Channel 1", "EXG Channel 2"]
        mapping = json.dumps({"T7": "EXG Channel 2", "F8": "EXG Channel 0"})
        result = resolve_channel_mapping(columns, "unknown.csv", mapping)

        self.assertEqual(result.channels, {"T7": "EXG Channel 2", "F8": "EXG Channel 0"})
        self.assertEqual(result.source, "user_provided")

    def test_duplicate_manual_columns_are_rejected(self):
        columns = ["EXG Channel 0", "EXG Channel 1"]
        mapping = json.dumps({"T7": "EXG Channel 0", "F8": "EXG Channel 0"})
        with self.assertRaises(ChannelMappingRequired):
            resolve_channel_mapping(columns, "unknown.csv", mapping)


if __name__ == "__main__":
    unittest.main()
