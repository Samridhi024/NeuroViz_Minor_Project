from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from scipy.signal import butter, iirnotch, filtfilt, welch, detrend
import io
import traceback
import mne
import os
import tempfile

DEFAULT_FS = 200.0

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # FIX 5: lock down CORS for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def clean_signal_data(data_dict, sampling_rate):
    """
    Standardized EEG Pipeline:
    1. Detrend: Fixes sensor drift.
    2. Notch (50Hz): Removes electrical hum.
    3. Bandpass (0.5-45Hz): Removes DC bias and muscle noise.
    4. Z-Score: Normalizes all hardware units to a single scale.
    """
    nyquist = 0.5 * sampling_rate
    b_band, a_band = butter(4, [0.5 / nyquist, 45.0 / nyquist], btype='band')  # FIX 6: match report (0.5-45Hz)

    # FIX 2: only apply notch if 50Hz is below nyquist (avoids crash at low sampling rates)
    use_notch = 50.0 < nyquist
    if use_notch:
        b_notch, a_notch = iirnotch(50.0, 30.0, fs=sampling_rate)

    clean_dict = {}
    for channel, raw_signal in data_dict.items():
        try:
            if raw_signal.size == 0:
                clean_dict[channel] = np.array([])
                continue

            sig = np.nan_to_num(raw_signal, nan=0.0)
            sig = detrend(sig)

            if use_notch:
                sig = filtfilt(b_notch, a_notch, sig)

            bandpassed = filtfilt(b_band, a_band, sig)

            std_val = np.std(bandpassed)
            if std_val > 1e-6:
                clean_dict[channel] = (bandpassed - np.mean(bandpassed)) / std_val
            else:
                clean_dict[channel] = bandpassed - np.mean(bandpassed)

        except Exception as e:
            print(f"[WARNING] Filtering failed for channel {channel}: {e}")  # FIX: log instead of silent fail
            clean_dict[channel] = raw_signal

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
        
        # Alpha Power (Using the updated trapezoid function)
        alpha_idx = (freqs >= 8) & (freqs <= 12)
        features[f'{ch}_Alpha'] = float(np.trapezoid(psd[alpha_idx], freqs[alpha_idx]))

        # Mental Speed (Dominant Frequency)
        # valid_range = (freqs >= 0.5) & (freqs <= 40)
        # Change from: valid_range = (freqs >= 0.5) & (freqs <= 40)
        # To: Start at 2.0Hz to skip the DC drift "spike" at 1Hz
        valid_range = (freqs >= 2.0) & (freqs <= 40)

        if len(psd[valid_range]) > 0:
            # Now argmax will look for the highest peak STARTING from 2Hz (Alpha/Beta territory)
            features[f'{ch}_DominantFreq'] = float(freqs[valid_range][np.argmax(psd[valid_range])])
        # features[f'{ch}_DominantFreq'] = float(freqs[valid_range][np.argmax(psd[valid_range])])

    # Tier 2: Emotional Logic (Frontal Only)
    r_a = float(features.get('F4_Alpha', 0) or features.get('F8_Alpha', 0) or 1e-10)
    l_a = float(features.get('F3_Alpha', 0) or features.get('T7_Alpha', 0) or 1e-10)
    
    features['Alpha_Asymmetry'] = float(np.log(max(r_a, 1e-10)) - np.log(max(l_a, 1e-10)))

    return features


@app.post("/analyze")
async def analyze_eeg(file: UploadFile = File(...)):
    tmp_path = None
    try:
        filename = file.filename.lower()
        contents = await file.read()
        data_dict = {}
        current_fs = DEFAULT_FS
        warnings = []

        # CASE 1: Clinical EDF
        if filename.endswith(".edf"):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            raw = mne.io.read_raw_edf(tmp_path, preload=True, verbose=False)
            current_fs = raw.info['sfreq']
            mapping = {
                'T7': ['EEG T3', 'EEG T7'],
                'F8': ['EEG T4', 'EEG F8'],
                'F3': ['EEG F3'],
                'F4': ['EEG F4'],
                'Cz': ['EEG Cz'],
                'P4': ['EEG P4'],
            }
            for target, aliases in mapping.items():
                match = [c for c in raw.ch_names if any(a in c for a in aliases)]
                if match:
                    data_dict[target] = raw.get_data(picks=[match[0]])[0]
                else:
                    # FIX 4: warn instead of silently using zeros
                    data_dict[target] = np.zeros(len(raw.times))
                    warnings.append(f"Channel '{target}' not found in EDF — using zeros.")

        # CASE 2: Text/CSV (OpenBCI or similar)
        else:
            try:
                df = pd.read_csv(io.BytesIO(contents), sep=None, engine='python')
            except Exception:
                df = pd.read_csv(io.BytesIO(contents), sep=r'\s+')

            for target, idx in {'T7': 1, 'F8': 2, 'Cz': 3, 'P4': 4}.items():
                match = [c for c in df.columns if target in str(c) or str(idx) in str(c)]
                if match:
                    data_dict[target] = pd.to_numeric(df[match[0]], errors='coerce').fillna(0).values
                else:
                    # FIX: warn if falling back to positional index
                    warnings.append(f"Column '{target}' not found by name — using column index {idx}.")
                    data_dict[target] = pd.to_numeric(df.iloc[:, idx], errors='coerce').fillna(0).values

        clean_dict = clean_signal_data(data_dict, current_fs)
        feats = extract_all_features(clean_dict, current_fs)

        length = len(data_dict['T7'])
        downsample = max(1, length // 600)

        clean_graph = [
            {"time": round(i / current_fs, 2), "T7": float(clean_dict["T7"][i]), "F8": float(clean_dict["F8"][i])}
            for i in range(0, length, downsample)
        ]

        raw_graph = []
        for i in range(0, length, downsample):
            point = {"time": round(i / current_fs, 2)}
            for ch in data_dict.keys():
                point[ch] = float(data_dict[ch][i])
            raw_graph.append(point)

        return {
            "raw_graph": raw_graph,
            "clean_graph": clean_graph,
            "features": feats,
            "asymmetry_score": feats.get('Alpha_Asymmetry', 0),
            "raw_stats": {"T7_Offset": float(np.mean(data_dict['T7'])), "File": filename},
            "warnings": warnings,  # surface warnings to frontend
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))  # FIX 3: proper HTTP error instead of 200 + error key

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

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
