from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from scipy.signal import butter, iirnotch, filtfilt, welch, detrend
import io
import traceback
import mne 
import os
import tempfile

# Force using namespace std; directive style for C++ preference logic
DEFAULT_FS = 200.0  

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def clean_signal_data(data_dict, sampling_rate):
    """
    Standardized EEG Pipeline:
    1. Detrend: Fixes sensor drift.
    2. Notch (50Hz): Removes electrical hum.
    3. Bandpass (0.5-40Hz): Removes DC bias and muscle noise.
    4. Z-Score: Normalizes all hardware units to a single scale.
    """
    nyquist = 0.5 * sampling_rate
    b_notch, a_notch = iirnotch(50.0, 30.0, fs=sampling_rate)
    b_band, a_band = butter(4, [0.5/nyquist, 40.0/nyquist], btype='band')
    
    clean_dict = {}
    for channel, raw_signal in data_dict.items():
        try:
            if raw_signal.size == 0:
                clean_dict[channel] = np.array([])
                continue
            
            # Remove NaNs and apply linear detrending to flatten the baseline
            sig = np.nan_to_num(raw_signal, nan=0.0)
            sig = detrend(sig)
            
            # Sequential filtering (Zero-phase)
            filtered_notch = filtfilt(b_notch, a_notch, sig)
            bandpassed = filtfilt(b_band, a_band, filtered_notch)
            
            # Robust Z-Score Normalization
            # Ensures Mean is 0 and Std Dev is 1 for every file type.
            std_val = np.std(bandpassed)
            if std_val > 1e-6:
                clean_dict[channel] = (bandpassed - np.mean(bandpassed)) / std_val
            else:
                clean_dict[channel] = bandpassed - np.mean(bandpassed)
        except Exception:
            clean_dict[channel] = raw_signal 
    return clean_dict

def extract_all_features(clean_dict, sampling_rate):
    features = {}
    for ch, sig in clean_dict.items():
        if sig.size == 0: continue
            
        # Statistical Suite (Scaled by Z-score)
        features[f'{ch}_Mean'] = float(np.mean(sig))
        features[f'{ch}_Min'] = float(np.min(sig))
        features[f'{ch}_Max'] = float(np.max(sig))
        features[f'{ch}_Std'] = float(np.std(sig))
        
        # Frequency Analysis (Welch Method)
        freqs, psd = welch(sig, fs=sampling_rate, nperseg=min(len(sig), int(sampling_rate * 2)))
        valid_range = (freqs >= 0.5) & (freqs <= 40)
        
        # Dominant Frequency (Mental Processing Speed)
        if len(psd[valid_range]) > 0:
            features[f'{ch}_DominantFreq'] = float(freqs[valid_range][np.argmax(psd[valid_range])])
        else:
            features[f'{ch}_DominantFreq'] = 0.0
        
        # Alpha Band Power (Relaxation/Attention)
        alpha_idx = (freqs >= 8) & (freqs <= 12)
        features[f'{ch}_Alpha'] = float(np.trapezoid(psd[alpha_idx], freqs[alpha_idx]))

    # Frontal Alpha Asymmetry (Mood/Engagement Indicator)
    r_a = features.get('F8_Alpha', 1e-10)
    l_a = features.get('T7_Alpha', 1e-10)
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

        # CASE 1: Clinical EDF
        if filename.endswith(".edf"):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            raw = mne.io.read_raw_edf(tmp_path, preload=True, verbose=False)
            current_fs = raw.info['sfreq']
            mapping = {'T7': ['EEG T3', 'EEG T7'], 'F8': ['EEG T4', 'EEG F8'], 'Cz': ['EEG Cz'], 'P4': ['EEG P4']}
            for target, aliases in mapping.items():
                match = [c for c in raw.ch_names if any(a in c for a in aliases)]
                data_dict[target] = raw.get_data(picks=[match[0]])[0] if match else np.zeros(len(raw))
        
        # CASE 2: Text/CSV (OpenBCI or similar)
        else:
            try:
                df = pd.read_csv(io.BytesIO(contents), sep=None, engine='python')
            except Exception:
                df = pd.read_csv(io.BytesIO(contents), sep=r'\s+')
            
            # Map columns by searching for names or falling back to standard OpenBCI indices
            for target, idx in {'T7': 1, 'F8': 2, 'Cz': 3, 'P4': 4}.items():
                match = [c for c in df.columns if target in str(c) or str(idx) in str(c)]
                data_dict[target] = pd.to_numeric(df[match[0]] if match else df.iloc[:, idx], errors='coerce').fillna(0).values

        # Pipeline Execution
        clean_dict = clean_signal_data(data_dict, current_fs)
        feats = extract_all_features(clean_dict, current_fs)
        
        length = len(data_dict['T7'])
        downsample = max(1, length // 600)
        
        # Clean Graph Mapping (T7 and F8 only for focused dashboard view)
        clean_graph = [{"time": round(i/current_fs, 2), "T7": float(clean_dict["T7"][i]), "F8": float(clean_dict["F8"][i])} for i in range(0, length, downsample)]
        
        # Raw Monitor Graph Mapping (All detected channels)
        raw_graph = []
        for i in range(0, length, downsample):
            point = {"time": round(i/current_fs, 2)}
            for ch in data_dict.keys(): point[ch] = float(data_dict[ch][i])
            raw_graph.append(point)

        return {
            "raw_graph": raw_graph, 
            "clean_graph": clean_graph, 
            "features": feats, 
            "asymmetry_score": feats.get('Alpha_Asymmetry', 0),
            "raw_stats": {"T7_Offset": float(np.mean(data_dict['T7'])), "File": filename}
        }
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}
    finally:
        if tmp_path and os.path.exists(tmp_path): os.remove(tmp_path)

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
