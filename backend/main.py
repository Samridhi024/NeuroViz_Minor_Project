from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
import pandas as pd
import numpy as np
from scipy.signal import butter, iirnotch, filtfilt, welch, detrend
import io
import traceback
import mne
import os
import re
import tempfile
from pathlib import Path

try:
    from .faa_metadata import build_faa_details
    from .channel_mapping import ChannelMappingRequired, resolve_channel_mapping
    from .dsp_features import (
        build_feature_metadata,
        compute_artifact_metrics,
        extract_extended_features,
    )
    from .cap_inference import analyze_cap_like_activity
except ImportError:
    from faa_metadata import build_faa_details
    from channel_mapping import ChannelMappingRequired, resolve_channel_mapping
    from dsp_features import (
        build_feature_metadata,
        compute_artifact_metrics,
        extract_extended_features,
    )
    from cap_inference import analyze_cap_like_activity

DEFAULT_FS = 200.0
GENERAL_EDF_PREVIEW_SECONDS = 30.0
GENERAL_EDF_MAX_CHANNELS = 8
GENERAL_GRAPH_POINTS = 600

EDF_NON_EEG_HINTS = (
    "EOG", "ROC", "LOC", "EMG", "ECG", "EKG", "PLETH", "HR", "SPO2",
    "SAO2", "AIRFLOW", "FLUSSO", "TORACE", "ADDOME", "ABDOMEN", "RESP",
    "POSITION", "POSIZIONE", "MIC", "STAT", "TERMISTORE", "SX", "DX",
)

EDF_CHANNEL_PRIORITY = (
    "C4-A1", "C3-A2", "F4-C4", "F3-C3", "C4-P4", "C3-P3",
    "P4-O2", "P3-O1", "FP2-F4", "FP1-F3",
)


def normalize_edf_label(label):
    """Create a readable, stable channel label without changing its montage."""
    cleaned = re.sub(r"^(EEG|POL)\s*[-:]?\s*", "", str(label), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", "", cleaned).upper()
    return cleaned


def is_eeg_edf_channel(label):
    """Detect scalp EEG derivations while excluding PSG auxiliary sensors."""
    normalized = normalize_edf_label(label)
    if not normalized or any(hint in normalized for hint in EDF_NON_EEG_HINTS):
        return False

    tokens = [token for token in re.split(r"[-_/]", normalized) if token]
    scalp_pattern = re.compile(r"^(?:FP|AF|F|FC|FT|C|CP|T|TP|P|PO|O)(?:Z|\d{1,2})$")
    reference_pattern = re.compile(r"^(?:A|M)\d$")
    has_scalp_electrode = any(scalp_pattern.fullmatch(token) for token in tokens)
    all_electrode_tokens = all(
        scalp_pattern.fullmatch(token) or reference_pattern.fullmatch(token)
        for token in tokens
    )
    return bool(has_scalp_electrode and all_electrode_tokens)


def choose_edf_eeg_channels(channel_names, maximum=GENERAL_EDF_MAX_CHANNELS):
    """Return real EEG channel names in a deterministic, sleep-useful order."""
    candidates = [name for name in channel_names if is_eeg_edf_channel(name)]
    by_normalized = {normalize_edf_label(name): name for name in candidates}
    ordered = [by_normalized[name] for name in EDF_CHANNEL_PRIORITY if name in by_normalized]
    ordered.extend(name for name in candidates if name not in ordered)
    return ordered[:maximum]


def trapezoidal_integral(values, coordinates):
    """Integrate with both older and newer NumPy versions."""
    if hasattr(np, 'trapezoid'):
        return float(np.trapezoid(values, coordinates))
    return float(np.trapz(values, coordinates))


app = FastAPI()

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

def clean_signal_data(data_dict, sampling_rate, return_filtered=False):
    """
    Standardized EEG Pipeline:
    1. Detrend: Fixes sensor drift.
    2. Notch (50Hz): Removes electrical hum.
    3. Bandpass (0.5-45Hz): Removes DC bias and muscle noise.
    4. Z-Score: Normalizes all hardware units to a single scale.
    """
    nyquist = 0.5 * sampling_rate
    high_cut = min(45.0, nyquist * 0.95)
    if high_cut <= 0.5:
        raise ValueError("Sampling rate is too low for the 0.5 Hz EEG high-pass cutoff.")
    b_band, a_band = butter(
        4,
        [0.5 / nyquist, high_cut / nyquist],
        btype='band',
    )  # 0.5-45 Hz when the sampling rate permits it.

    # FIX 2: only apply notch if 50Hz is below nyquist (avoids crash at low sampling rates)
    use_notch = 50.0 < nyquist
    if use_notch:
        b_notch, a_notch = iirnotch(50.0, 30.0, fs=sampling_rate)

    clean_dict = {}
    filtered_dict = {}
    for channel, raw_signal in data_dict.items():
        try:
            if raw_signal.size == 0:
                clean_dict[channel] = np.array([])
                filtered_dict[channel] = np.array([])
                continue

            sig = np.nan_to_num(raw_signal, nan=0.0)
            sig = detrend(sig)

            if use_notch:
                sig = filtfilt(b_notch, a_notch, sig)

            bandpassed = filtfilt(b_band, a_band, sig)
            filtered_dict[channel] = bandpassed

            std_val = np.std(bandpassed)
            if std_val > 1e-6:
                clean_dict[channel] = (bandpassed - np.mean(bandpassed)) / std_val
            else:
                clean_dict[channel] = bandpassed - np.mean(bandpassed)

        except Exception as e:
            print(f"[WARNING] Filtering failed for channel {channel}: {e}")  # FIX: log instead of silent fail
            clean_dict[channel] = raw_signal
            filtered_dict[channel] = raw_signal

    if return_filtered:
        return clean_dict, filtered_dict
    return clean_dict


# def extract_all_features(clean_dict, sampling_rate):
#     features = {}
#     for ch, sig in clean_dict.items():
#         sig = np.nan_to_num(sig)
#         if sig.size == 0:
#             continue

#         features[f'{ch}_Mean'] = float(np.mean(sig))
#         features[f'{ch}_Min'] = float(np.min(sig))
#         features[f'{ch}_Max'] = float(np.max(sig))
#         features[f'{ch}_Std'] = float(np.std(sig))

#         freqs, psd = welch(sig, fs=sampling_rate, nperseg=min(len(sig), int(sampling_rate * 2)))
#         valid_range = (freqs >= 0.5) & (freqs <= 40)

#         if len(psd[valid_range]) > 0:
#             features[f'{ch}_DominantFreq'] = float(freqs[valid_range][np.argmax(psd[valid_range])])
#         else:
#             features[f'{ch}_DominantFreq'] = 0.0

#         alpha_idx = (freqs >= 8) & (freqs <= 12)
#         # features[f'{ch}_Alpha'] = float(np.trapezoid(psd[alpha_idx], freqs[alpha_idx]))
#         features[f'{ch}_Alpha'] = float(np.trapz(psd[alpha_idx], freqs[alpha_idx]))

#     # FIX 1: Frontal Alpha Asymmetry — use F4 (right frontal) vs F3 (left frontal)
#     # Standard FAA formula: ln(right_frontal_alpha) - ln(left_frontal_alpha)
#     # Falling back to F8/T7 if F3/F4 are not present in the recording
#     r_a = features.get('F4_Alpha') or features.get('F8_Alpha', 1e-10)
#     l_a = features.get('F3_Alpha') or features.get('T7_Alpha', 1e-10)
#     features['Alpha_Asymmetry'] = float(np.log(max(r_a, 1e-10)) - np.log(max(l_a, 1e-10)))

#     return features

# def extract_all_features(clean_dict, sampling_rate):
#     features = {}
    
#     # Tier 1: General Stats (For all sensors)
#     for ch, sig in clean_dict.items():
#         sig = np.nan_to_num(sig)
#         if sig.size == 0: continue
        
#         # We keep these so the 'Raw Monitor' in React has numbers to show
#         features[f'{ch}_Max'] = float(np.max(sig))
#         features[f'{ch}_Std'] = float(np.std(sig))

#         # Frequency Analysis
#         freqs, psd = welch(sig, fs=sampling_rate, nperseg=min(len(sig), int(sampling_rate * 2)))
        
#         # Alpha Power (Used for Asymmetry)
#         alpha_idx = (freqs >= 8) & (freqs <= 12)
#         features[f'{ch}_Alpha'] = float(np.trapezoid(psd[alpha_idx], freqs[alpha_idx]))

#         # Mental Speed (Dominant Frequency in 0.5-40Hz range)
#         valid_range = (freqs >= 0.5) & (freqs <= 40)
#         features[f'{ch}_DominantFreq'] = float(freqs[valid_range][np.argmax(psd[valid_range])])

#     # Tier 2: Emotional Logic (Frontal Only)
#     # We ignore Cz and P4 here!
#     r_a = float(features.get('F4_Alpha', 0) or features.get('F8_Alpha', 0) or 1e-10)
#     l_a = float(features.get('F3_Alpha', 0) or features.get('T7_Alpha', 0) or 1e-10)
    
#     features['Alpha_Asymmetry'] = float(np.log(max(r_a, 1e-10)) - np.log(max(l_a, 1e-10)))

#     return features

def extract_all_features(clean_dict, sampling_rate):
    features = {}
    
    # Tier 1: General Stats (For all sensors)
    for ch, sig in clean_dict.items():
        sig = np.nan_to_num(sig)
        if sig.size == 0: continue
        
        # ADD THESE LINES BACK:
        features[f'{ch}_Mean'] = float(np.mean(sig)) # Will be ~0 due to Z-score
        features[f'{ch}_Min'] = float(np.min(sig))   # Critical for signal range
        features[f'{ch}_Max'] = float(np.max(sig))
        features[f'{ch}_Std'] = float(np.std(sig))   # Will be ~1 due to Z-score

        # Frequency Analysis
        freqs, psd = welch(sig, fs=sampling_rate, nperseg=min(len(sig), int(sampling_rate * 2)))
        
        # Alpha Power (compatible with both older and newer NumPy versions)
        alpha_idx = (freqs >= 8) & (freqs <= 12)
        features[f'{ch}_Alpha'] = trapezoidal_integral(psd[alpha_idx], freqs[alpha_idx])

        # Mental Speed (Dominant Frequency)
        # valid_range = (freqs >= 0.5) & (freqs <= 40)
        # Change from: valid_range = (freqs >= 0.5) & (freqs <= 40)
        # To: Start at 2.0Hz to skip the DC drift "spike" at 1Hz
        valid_range = (freqs >= 2.0) & (freqs <= 40)

        if len(psd[valid_range]) > 0:
            # Now argmax will look for the highest peak STARTING from 2Hz (Alpha/Beta territory)
            features[f'{ch}_DominantFreq'] = float(freqs[valid_range][np.argmax(psd[valid_range])])
        # features[f'{ch}_DominantFreq'] = float(freqs[valid_range][np.argmax(psd[valid_range])])

    # Tier 2: FAA is valid only when a supported left/right pair is present.
    # A bipolar channel such as F4-C4 is not the same signal as electrode F4.
    faa_pair = None
    if 'F3_Alpha' in features and 'F4_Alpha' in features:
        faa_pair = ('F3', 'F4')
    elif 'T7_Alpha' in features and 'F8_Alpha' in features:
        faa_pair = ('T7', 'F8')

    if faa_pair:
        left_alpha = max(float(features[f'{faa_pair[0]}_Alpha']), 1e-10)
        right_alpha = max(float(features[f'{faa_pair[1]}_Alpha']), 1e-10)
        features['Alpha_Asymmetry'] = float(np.log(right_alpha) - np.log(left_alpha))
    else:
        features['Alpha_Asymmetry'] = None

    return features


@app.post("/analyze")
async def analyze_eeg(
    file: UploadFile = File(...),
    channel_mapping: str | None = Form(default=None),
):
    tmp_path = None
    edf_raw = None
    try:
        filename = (file.filename or "recording").lower()
        data_dict = {}
        current_fs = DEFAULT_FS
        warnings = []
        mapping_details = {}
        source_signal_unit = "source file units"
        analysis_scope = {
            "mode": "complete_uploaded_signal",
            "preview_seconds": None,
            "message": "The uploaded TXT/CSV signal was processed in full.",
        }

        # CASE 1: Clinical EDF
        if filename.endswith(".edf"):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
                tmp_path = tmp.name
            await save_upload_in_chunks(file, Path(tmp_path))

            # Load only a short preview for the general viewer. The separate sleep
            # endpoint performs the annotation-aligned all-night analysis.
            edf_raw = mne.io.read_raw_edf(tmp_path, preload=False, verbose=False)
            current_fs = float(edf_raw.info['sfreq'])
            selected_edf_channels = choose_edf_eeg_channels(edf_raw.ch_names)
            if not selected_edf_channels:
                raise HTTPException(
                    status_code=422,
                    detail="No scalp EEG channels could be identified in this EDF.",
                )

            preview_samples = min(
                int(round(GENERAL_EDF_PREVIEW_SECONDS * current_fs)),
                int(edf_raw.n_times),
            )
            preview_matrix = edf_raw.get_data(
                picks=selected_edf_channels,
                start=0,
                stop=preview_samples,
            ) * 1e6  # MNE returns SI volts; the interface displays microvolts.
            full_recording_seconds = float(edf_raw.n_times) / current_fs
            edf_raw.close()
            edf_raw = None

            resolved_edf_channels = {}
            for row_index, source_name in enumerate(selected_edf_channels):
                display_name = normalize_edf_label(source_name)
                if display_name in data_dict:
                    display_name = f"{display_name}-{row_index + 1}"
                data_dict[display_name] = np.asarray(preview_matrix[row_index], dtype=float)
                resolved_edf_channels[display_name] = source_name

            source_signal_unit = "microvolts"
            preview_duration = preview_samples / current_fs
            analysis_scope = {
                "mode": "edf_preview",
                "preview_seconds": round(preview_duration, 3),
                "full_recording_seconds": round(full_recording_seconds, 3),
                "message": (
                    f"The general viewer processed the first {preview_duration:.1f} seconds. "
                    "Use Sleep Analysis with the matching TXT for annotation-aligned N2/N3 analysis."
                ),
            }
            warnings.append(analysis_scope["message"])
            if len(selected_edf_channels) == GENERAL_EDF_MAX_CHANNELS:
                warnings.append(
                    f"The general preview is limited to {GENERAL_EDF_MAX_CHANNELS} EEG channels."
                )
            mapping_details = {
                "channels": resolved_edf_channels,
                "source": "edf_labels",
                "confidence": "high",
                "profile": None,
            }

        # CASE 2: Text/CSV (OpenBCI or similar)
        else:
            contents = await file.read()
            try:
                df = pd.read_csv(io.BytesIO(contents), sep=None, engine='python')
            except Exception:
                df = pd.read_csv(io.BytesIO(contents), sep=r'\s+')

            try:
                resolved_mapping = resolve_channel_mapping(
                    df.columns,
                    filename,
                    channel_mapping,
                )
            except ChannelMappingRequired as error:
                raise HTTPException(status_code=422, detail=error.as_detail()) from error

            for target, column in resolved_mapping.channels.items():
                data_dict[target] = pd.to_numeric(
                    df[column],
                    errors='coerce',
                ).fillna(0).values
            mapping_details = resolved_mapping.as_response()
            if resolved_mapping.source == "verified_dataset_profile":
                source_signal_unit = "microvolts (verified PhysioNet profile)"
                warnings.append(
                    "Generic EXG columns were mapped using the verified PhysioNet auditory EEG profile."
                )

        clean_dict, filtered_dict = clean_signal_data(
            data_dict,
            current_fs,
            return_filtered=True,
        )
        feats = extract_all_features(clean_dict, current_fs)
        extended_features, feature_warnings = extract_extended_features(
            clean_dict,
            current_fs,
            filtered_dict,
        )
        for feature_name, feature_value in extended_features.items():
            feats.setdefault(feature_name, feature_value)
        warnings.extend(feature_warnings)
        artifacts = compute_artifact_metrics(clean_dict, current_fs)
        artifacts["compatible"] = "T7" in clean_dict and "F8" in clean_dict
        if not artifacts["compatible"]:
            artifacts["method"] = "Unavailable for this montage"
            artifacts["usage"] = (
                "The submitted T7/F8 threshold screen needs both exact channels. "
                "No zero-filled substitute was used."
            )
        feature_metadata = build_feature_metadata(source_signal_unit)
        faa_details = build_faa_details(
            data_dict,
            current_fs,
            feats.get('Alpha_Asymmetry'),
        )

        available_channels = list(data_dict.keys())
        if not available_channels:
            raise HTTPException(status_code=422, detail="No usable EEG channels were found.")

        length = min(len(signal) for signal in data_dict.values())
        if length < 16:
            raise HTTPException(status_code=422, detail="The EEG signal is too short to analyze.")

        graph_point_count = min(length, GENERAL_GRAPH_POINTS)
        graph_indices = np.unique(
            np.linspace(0, length - 1, graph_point_count, dtype=int)
        )

        raw_graph = []
        clean_graph = []
        for index in graph_indices:
            time_value = round(float(index) / current_fs, 3)
            raw_point = {"time": time_value}
            clean_point = {"time": time_value}
            for channel in available_channels:
                raw_point[channel] = float(data_dict[channel][index])
                clean_point[channel] = float(clean_dict[channel][index])
            raw_graph.append(raw_point)
            clean_graph.append(clean_point)

        raw_channel_stats = {
            channel: {
                "Mean": float(np.mean(signal)),
                "Min": float(np.min(signal)),
                "Max": float(np.max(signal)),
                "Std": float(np.std(signal)),
            }
            for channel, signal in data_dict.items()
            if signal.size
        }

        return {
            "raw_graph": raw_graph,
            "clean_graph": clean_graph,
            "features": feats,
            "asymmetry_score": feats.get('Alpha_Asymmetry'),
            "faa_details": faa_details,
            "available_channels": available_channels,
            "analysis_scope": analysis_scope,
            "channel_mapping": mapping_details,
            "artifacts": artifacts,
            "feature_metadata": feature_metadata,
            "raw_stats": {
                "T7_Offset": float(np.mean(data_dict['T7'])) if 'T7' in data_dict else None,
                "reference_channel": available_channels[0],
                "File": filename,
                "Unit": source_signal_unit,
                "channels": raw_channel_stats,
            },
            "warnings": warnings,  # surface warnings to frontend
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))  # FIX 3: proper HTTP error instead of 200 + error key

    finally:
        if edf_raw is not None:
            edf_raw.close()
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


SLEEP_UPLOAD_CHUNK_BYTES = 1024 * 1024
DEFAULT_SLEEP_MAX_EPOCHS = 120
MAX_SLEEP_EPOCHS_PER_REQUEST = 600


async def save_upload_in_chunks(upload: UploadFile, destination: Path):
    """Write a potentially large upload without loading it fully into RAM."""
    await upload.seek(0)
    with destination.open("wb") as output_file:
        while True:
            chunk = await upload.read(SLEEP_UPLOAD_CHUNK_BYTES)
            if not chunk:
                break
            output_file.write(chunk)


@app.post("/analyze-sleep")
async def analyze_sleep_eeg(
    edf_file: UploadFile = File(...),
    annotation_file: UploadFile = File(...),
    max_epochs: int = Form(default=DEFAULT_SLEEP_MAX_EPOCHS),
    include_epoch_predictions: bool = Form(default=False),
):
    """
    Run the separate research-only CAP A-like sleep analysis.

    The EDF must contain C4-A1. The paired TXT file supplies N2/N3 timing.
    CAP labels in the TXT file are not used as inputs to the model.
    """
    edf_filename = (edf_file.filename or "").strip()
    annotation_filename = (annotation_file.filename or "").strip()

    if not edf_filename.lower().endswith(".edf"):
        raise HTTPException(
            status_code=422,
            detail="The sleep recording must be an EDF file.",
        )

    if not annotation_filename.lower().endswith(".txt"):
        raise HTTPException(
            status_code=422,
            detail="The paired sleep-stage annotation must be a TXT file.",
        )

    if not 1 <= max_epochs <= MAX_SLEEP_EPOCHS_PER_REQUEST:
        raise HTTPException(
            status_code=422,
            detail=(
                "max_epochs must be between 1 and "
                f"{MAX_SLEEP_EPOCHS_PER_REQUEST}."
            ),
        )

    try:
        # Fixed temporary names avoid trusting user-provided path components.
        with tempfile.TemporaryDirectory(prefix="neuroviz_sleep_") as temp_dir:
            temp_directory = Path(temp_dir)
            edf_path = temp_directory / "recording.edf"
            annotation_path = temp_directory / "annotations.txt"

            await save_upload_in_chunks(edf_file, edf_path)
            await save_upload_in_chunks(annotation_file, annotation_path)

            result = await run_in_threadpool(
                analyze_cap_like_activity,
                edf_path=edf_path,
                annotation_path=annotation_path,
                maximum_epochs=max_epochs,
                include_epoch_predictions=include_epoch_predictions,
            )

            # Restore original display names because inference used safe temp names.
            result["recording"]["edf_file"] = edf_filename
            result["recording"]["annotation_file"] = annotation_filename
            return result

    except HTTPException:
        raise
    except FileNotFoundError as error:
        # Usually indicates that the trusted server-side model artifact is absent.
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        # Missing C4-A1, incompatible annotations, or invalid EEG content.
        traceback.print_exc()
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Sleep analysis failed. Check the backend log for details.",
        ) from error

# from fastapi import FastAPI, UploadFile, File
# from fastapi.middleware.cors import CORSMiddleware
# import pandas as pd
# import numpy as np
# from scipy.signal import butter, iirnotch, filtfilt, welch, detrend
# import io
# import traceback
# import mne 
# import os
# import tempfile

# # Force using namespace std; directive style for C++ preference logic
# DEFAULT_FS = 200.0  

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"], 
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# def clean_signal_data(data_dict, sampling_rate):
#     """
#     Standardized EEG Pipeline:
#     1. Detrend: Fixes sensor drift.
#     2. Notch (50Hz): Removes electrical hum.
#     3. Bandpass (0.5-40Hz): Removes DC bias and muscle noise.
#     4. Z-Score: Normalizes all hardware units to a single scale.
#     """
#     nyquist = 0.5 * sampling_rate
#     b_notch, a_notch = iirnotch(50.0, 30.0, fs=sampling_rate)
#     # b_band, a_band = butter(4, [0.5/nyquist, 40.0/nyquist], btype='band')
#     b_band, a_band = butter(4, [0.5/nyquist, 30.0/nyquist], btype='band')
    
#     clean_dict = {}
#     for channel, raw_signal in data_dict.items():
#         try:
#             if raw_signal.size == 0:
#                 clean_dict[channel] = np.array([])
#                 continue
            
#             # Remove NaNs and apply linear detrending to flatten the baseline
#             sig = np.nan_to_num(raw_signal, nan=0.0)
#             sig = detrend(sig)
            
#             # Sequential filtering (Zero-phase)
#             filtered_notch = filtfilt(b_notch, a_notch, sig)
#             bandpassed = filtfilt(b_band, a_band, filtered_notch)
            
#             # Robust Z-Score Normalization
#             # Ensures Mean is 0 and Std Dev is 1 for every file type.
#             # std_val = np.std(bandpassed)
#             # if std_val > 1e-6:
#             #     clean_dict[channel] = (bandpassed - np.mean(bandpassed)) / std_val
#             # else:
#             #     clean_dict[channel] = bandpassed - np.mean(bandpassed)

#             # Replace your Z-score block with this:
#             std_val = np.std(bandpassed)
#             if std_val > 1e-6: # Only divide if there is actual signal
#                 clean_dict[channel] = (bandpassed - np.mean(bandpassed)) / std_val
#             else:
#                 # If the signal is flat, just center it at 0 without dividing
#                 clean_dict[channel] = bandpassed - np.mean(bandpassed)
#         except Exception:
#             clean_dict[channel] = raw_signal 
#     return clean_dict

# def extract_all_features(clean_dict, sampling_rate):
#     features = {}
#     # for ch, sig in clean_dict.items():
#     #     if sig.size == 0: continue
#     for ch, sig in clean_dict.items():
#         # Clean any NaNs in the signal first
#         sig = np.nan_to_num(sig) 
#         if sig.size == 0: continue
            
#         # Statistical Suite (Scaled by Z-score)
#         features[f'{ch}_Mean'] = float(np.mean(sig))
#         features[f'{ch}_Min'] = float(np.min(sig))
#         features[f'{ch}_Max'] = float(np.max(sig))
#         features[f'{ch}_Std'] = float(np.std(sig))
        
#         # Frequency Analysis (Welch Method)
#         freqs, psd = welch(sig, fs=sampling_rate, nperseg=min(len(sig), int(sampling_rate * 2)))
#         valid_range = (freqs >= 0.5) & (freqs <= 40)
        
#         # Dominant Frequency (Mental Processing Speed)
#         if len(psd[valid_range]) > 0:
#             features[f'{ch}_DominantFreq'] = float(freqs[valid_range][np.argmax(psd[valid_range])])
#         else:
#             features[f'{ch}_DominantFreq'] = 0.0
        
#         # Alpha Band Power (Relaxation/Attention)
#         alpha_idx = (freqs >= 8) & (freqs <= 12)
#         features[f'{ch}_Alpha'] = float(np.trapezoid(psd[alpha_idx], freqs[alpha_idx]))

#     # Frontal Alpha Asymmetry (Mood/Engagement Indicator)
#     r_a = features.get('F8_Alpha', 1e-10)
#     l_a = features.get('T7_Alpha', 1e-10)
#     features['Alpha_Asymmetry'] = float(np.log(max(r_a, 1e-10)) - np.log(max(l_a, 1e-10)))
    
#     return features

# @app.post("/analyze")
# async def analyze_eeg(file: UploadFile = File(...)):
#     tmp_path = None
#     try:
#         filename = file.filename.lower()
#         contents = await file.read()
#         data_dict = {}
#         current_fs = DEFAULT_FS

#         # CASE 1: Clinical EDF
#         if filename.endswith(".edf"):
#             with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
#                 tmp.write(contents)
#                 tmp_path = tmp.name
#             raw = mne.io.read_raw_edf(tmp_path, preload=True, verbose=False)
#             current_fs = raw.info['sfreq']
#             mapping = {'T7': ['EEG T3', 'EEG T7'], 'F8': ['EEG T4', 'EEG F8'], 'Cz': ['EEG Cz'], 'P4': ['EEG P4']}
#             for target, aliases in mapping.items():
#                 match = [c for c in raw.ch_names if any(a in c for a in aliases)]
#                 data_dict[target] = raw.get_data(picks=[match[0]])[0] if match else np.zeros(len(raw))
        
#         # CASE 2: Text/CSV (OpenBCI or similar)
#         else:
#             try:
#                 df = pd.read_csv(io.BytesIO(contents), sep=None, engine='python')
#             except Exception:
#                 df = pd.read_csv(io.BytesIO(contents), sep=r'\s+')
            
#             # Map columns by searching for names or falling back to standard OpenBCI indices
#             for target, idx in {'T7': 1, 'F8': 2, 'Cz': 3, 'P4': 4}.items():
#                 match = [c for c in df.columns if target in str(c) or str(idx) in str(c)]
#                 data_dict[target] = pd.to_numeric(df[match[0]] if match else df.iloc[:, idx], errors='coerce').fillna(0).values

#         # Pipeline Execution
#         clean_dict = clean_signal_data(data_dict, current_fs)
#         feats = extract_all_features(clean_dict, current_fs)
        
#         length = len(data_dict['T7'])
#         downsample = max(1, length // 600)
        
#         # Clean Graph Mapping (T7 and F8 only for focused dashboard view)
#         clean_graph = [{"time": round(i/current_fs, 2), "T7": float(clean_dict["T7"][i]), "F8": float(clean_dict["F8"][i])} for i in range(0, length, downsample)]
        
#         # Raw Monitor Graph Mapping (All detected channels)
#         raw_graph = []
#         for i in range(0, length, downsample):
#             point = {"time": round(i/current_fs, 2)}
#             for ch in data_dict.keys(): point[ch] = float(data_dict[ch][i])
#             raw_graph.append(point)

#         return {
#             "raw_graph": raw_graph, 
#             "clean_graph": clean_graph, 
#             "features": feats, 
#             "asymmetry_score": feats.get('Alpha_Asymmetry', 0),
#             "raw_stats": {"T7_Offset": float(np.mean(data_dict['T7'])), "File": filename}
#         }
#     except Exception as e:
#         traceback.print_exc()
#         return {"error": str(e)}
#     finally:
#         if tmp_path and os.path.exists(tmp_path): os.remove(tmp_path)

# from fastapi import FastAPI, UploadFile, File
# from fastapi.middleware.cors import CORSMiddleware
# import pandas as pd
# import numpy as np
# from scipy.signal import butter, iirnotch, filtfilt, welch, detrend
# import io
# import traceback
# import mne 
# import os
# import tempfile

# DEFAULT_FS = 200.0  

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"], 
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# def clean_signal_data(data_dict, sampling_rate):
#     nyquist = 0.5 * sampling_rate
#     b_notch, a_notch = iirnotch(50.0, 30.0, fs=sampling_rate)
#     b_band, a_band = butter(4, [0.5/nyquist, 45.0/nyquist], btype='band')
    
#     clean_dict = {}
#     for channel, raw_signal in data_dict.items():
#         try:
#             if raw_signal.size == 0:
#                 clean_dict[channel] = np.array([])
#                 continue
            
#             sig = np.nan_to_num(raw_signal, nan=0.0)
#             sig = detrend(sig)
#             sig = filtfilt(b_notch, a_notch, sig)
#             sig = filtfilt(b_band, a_band, sig)
            
#             # Robust Normalization
#             std_val = np.std(sig)
#             clean_dict[channel] = (sig - np.mean(sig)) / std_val if std_val > 1e-6 else sig - np.mean(sig)
#         except:
#             clean_dict[channel] = raw_signal 
#     return clean_dict

# def extract_all_features(clean_dict, sampling_rate):
#     features = {}
#     for ch, sig in clean_dict.items():
#         if sig.size == 0: continue
            
#         # Full Statistical Suite
#         features[f'{ch}_Mean'] = float(np.mean(sig))
#         features[f'{ch}_Min'] = float(np.min(sig))
#         features[f'{ch}_Max'] = float(np.max(sig))
#         features[f'{ch}_Std'] = float(np.std(sig))
        
#         # Frequency Features
#         freqs, psd = welch(sig, fs=sampling_rate, nperseg=min(len(sig), int(sampling_rate * 2)))
#         valid = (freqs >= 0.5) & (freqs <= 45)
#         features[f'{ch}_DominantFreq'] = float(freqs[valid][np.argmax(psd[valid])])
        
#         alpha_idx = (freqs >= 8) & (freqs <= 12)
#         # features[f'{ch}_Alpha'] = float(np.trapz(psd[alpha_idx], freqs[alpha_idx]))
#         features[f'{ch}_Alpha'] = float(np.trapezoid(psd[alpha_idx], freqs[alpha_idx]))

#     # Asymmetry calculation
#     r_a = features.get('F8_Alpha', 1e-10)
#     l_a = features.get('T7_Alpha', 1e-10)
#     features['Alpha_Asymmetry'] = float(np.log(max(r_a, 1e-10)) - np.log(max(l_a, 1e-10)))
#     return features

# @app.post("/analyze")
# async def analyze_eeg(file: UploadFile = File(...)):
#     tmp_path = None
#     try:
#         filename = file.filename.lower()
#         contents = await file.read()
#         data_dict = {}
#         current_fs = DEFAULT_FS

#         if filename.endswith(".edf"):
#             with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
#                 tmp.write(contents)
#                 tmp_path = tmp.name
#             raw = mne.io.read_raw_edf(tmp_path, preload=True, verbose=False)
#             current_fs = raw.info['sfreq']
#             mapping = {'T7': ['EEG T3', 'EEG T7'], 'F8': ['EEG T4', 'EEG F8'], 'Cz': ['EEG Cz'], 'P4': ['EEG P4']}
#             for target, aliases in mapping.items():
#                 match = [c for c in raw.ch_names if any(a in c for a in aliases)]
#                 data_dict[target] = raw.get_data(picks=[match[0]])[0] if match else np.zeros(len(raw))
#         else:
#             try:
#                 df = pd.read_csv(io.BytesIO(contents), sep=None, engine='python')
#             except:
#                 df = pd.read_csv(io.BytesIO(contents), sep=r'\s+')
#             for target, idx in {'T7': 1, 'F8': 2, 'Cz': 3, 'P4': 4}.items():
#                 match = [c for c in df.columns if target in str(c) or str(idx) in str(c)]
#                 data_dict[target] = pd.to_numeric(df[match[0]] if match else df.iloc[:, idx], errors='coerce').fillna(0).values

#         clean_dict = clean_signal_data(data_dict, current_fs)
#         feats = extract_all_features(clean_dict, current_fs)
        
#         length = len(data_dict['T7'])
#         downsample = max(1, length // 600)
#         raw_graph = []
#         for i in range(0, length, downsample):
#             point = {"time": round(i/current_fs, 2)}
#             for ch in data_dict.keys(): point[ch] = float(data_dict[ch][i])
#             raw_graph.append(point)

#         return {
#             "raw_graph": raw_graph, 
#             "clean_graph": [{"time": round(i/current_fs, 2), "T7": float(clean_dict["T7"][i]), "F8": float(clean_dict["F8"][i])} for i in range(0, length, downsample)],
#             "features": feats, 
#             "asymmetry_score": feats.get('Alpha_Asymmetry', 0),
#             "raw_stats": {"T7_Offset": float(np.mean(data_dict['T7'])), "File": filename}
#         }
#     except Exception as e:
#         traceback.print_exc()
#         return {"error": str(e)}
#     finally:
#         if tmp_path and os.path.exists(tmp_path): os.remove(tmp_path)
