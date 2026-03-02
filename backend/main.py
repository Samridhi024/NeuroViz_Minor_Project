from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from scipy.signal import butter, iirnotch, filtfilt, welch
import pywt 
import io
import traceback

# Sampling Frequency (Hz)
FS = 200.0  

app = FastAPI()

# CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. SIGNAL CLEANING (Updated with Zero-Mean and Robust Scaling)
def clean_signal_data(data_dict):
    """
    Applies Digital Signal Processing (DSP) to remove noise and equalize channels.
    1. Notch Filter (50Hz): Removes power line hum.
    2. Bandpass Filter (0.5-50Hz): Isolates brainwaves.
    3. Mean Centering: Forces signal to baseline 0.
    4. Z-Score Normalization: Equalizes amplitude deviations.
    """
    b_notch, a_notch = iirnotch(50.0, 30.0, fs=FS)
    
    nyquist = 0.5 * FS
    # Using 45Hz as high-cut to stay safely away from the 50Hz noise floor
    b_band, a_band = butter(4, [0.5/nyquist, 45.0/nyquist], btype='band')
    
    clean_dict = {}
    
    for channel, raw_signal in data_dict.items():
        try:
            # Handle NaN and Infinity
            signal_np = np.nan_to_num(raw_signal, nan=0.0, posinf=0.0, neginf=0.0)

            # Step A: Apply Notch and Bandpass
            filtered = filtfilt(b_notch, a_notch, signal_np)
            bandpassed = filtfilt(b_band, a_band, filtered)
            
            # Step B: FIX DEVIATION - Mean Centering (Zero-Baseline)
            centered_signal = bandpassed - np.mean(bandpassed)

            # Step C: FIX SCALE - Z-Score Normalization
            # This ensures T7 and F8 are visually comparable on the same Y-axis
            std_dev = np.std(centered_signal)
            if std_dev > 1e-6: # Avoid division by zero
                final_signal = centered_signal / std_dev
            else:
                final_signal = centered_signal

            clean_dict[channel] = final_signal
            
        except Exception as e:
            print(f"Skipping {channel} due to filter error: {e}")
            clean_dict[channel] = raw_signal 
            
    return clean_dict

# 2. FEATURE EXTRACTION 
def extract_all_features(clean_dict):
    features = {}
    spectrum_data = [] 
    
    target_channels = ['T7', 'F8']

    for channel in target_channels:
        if channel not in clean_dict: continue
        
        signal = clean_dict[channel]
        signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)
        
        # A. STATISTICAL FEATURES
        features[f'{channel}_Mean'] = float(np.mean(signal))
        features[f'{channel}_Std'] = float(np.std(signal)) 
        features[f'{channel}_Max'] = float(np.max(signal))
        features[f'{channel}_Min'] = float(np.min(signal))

        # B. POWER SPECTRAL DENSITY (PSD)
        freqs, psd = welch(signal, fs=FS, nperseg=int(FS*2))
        
        # Dominant Frequency
        peak_idx = np.argmax(psd)
        dominant_freq = freqs[peak_idx]
        features[f'{channel}_DominantFreq'] = float(dominant_freq)

        # C. BAND POWERS
        bands = {'Delta': (0.5, 4), 'Theta': (4, 8), 'Alpha': (8, 12), 'Beta': (12, 30), 'Gamma': (30, 40)}
        for band_name, (low, high) in bands.items():
            idx = np.logical_and(freqs >= low, freqs <= high)
            features[f'{channel}_{band_name}'] = float(np.trapz(psd[idx], freqs[idx]))

        # D. WAVELET ENERGY
        try:
            coeffs = pywt.wavedec(signal, 'db4', level=4)
            energy = sum([np.sum(np.square(c)) for c in coeffs])
            features[f'{channel}_WaveletEnergy'] = float(energy)
        except:
            features[f'{channel}_WaveletEnergy'] = 0.0

    # SPECTRUM DATA FOR VISUALIZATION
    if 'T7' in clean_dict and 'F8' in clean_dict:
        f_t7, psd_t7 = welch(clean_dict['T7'], fs=FS, nperseg=int(FS*2))
        _, psd_f8 = welch(clean_dict['F8'], fs=FS, nperseg=int(FS*2))
        
        limit = 40 
        for i in range(len(f_t7)):
            if f_t7[i] > limit: break
            spectrum_data.append({
                "frequency": float(f_t7[i]),
                "T7": float(psd_t7[i]),
                "F8": float(psd_f8[i])
            })

    # ALPHA ASYMMETRY SCORE
    right = features.get('F8_Alpha', 1e-10)
    left = features.get('T7_Alpha', 1e-10)
    features['Alpha_Asymmetry'] = float(np.log(max(right, 1e-10)) - np.log(max(left, 1e-10)))
    
    return features, spectrum_data

# 3. API ENDPOINT 
@app.post("/analyze")
async def analyze_eeg(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        # 1. READ FILE
        try:
            df = pd.read_csv(io.BytesIO(contents), header=None, sep=',', usecols=[0,1,2,3,4])
        except:
            df = pd.read_csv(io.BytesIO(contents), header=None, sep=r'\s+', usecols=[0,1,2,3,4])

        df = df.apply(pd.to_numeric, errors='coerce').dropna()
        
        data_dict = {
            'T7': df.iloc[:, 1].values,
            'F8': df.iloc[:, 2].values,
            'Cz': df.iloc[:, 3].values,
            'P4': df.iloc[:, 4].values
        }
        
        # 2. RAW STATS
        raw_stats = {
            "T7_Offset": float(np.mean(data_dict['T7'])),
            "T7_Noise": float(np.std(data_dict['T7'])),
            "Status": "STABLE"
        }

        # 3. PREPARE GRAPH DATA
        raw_graph = []
        length = len(data_dict['T7'])
        timestamps = np.arange(length) / FS
        downsample = 10 
        
        for i in range(0, length, downsample):
            raw_graph.append({
                "time": float(timestamps[i]),
                "T7": float(data_dict["T7"][i]),
                "F8": float(data_dict["F8"][i]),
                "Cz": float(data_dict["Cz"][i]),
                "P4": float(data_dict["P4"][i])
            })

        # 4. PROCESSING
        clean_dict = clean_signal_data(data_dict)
        feats, spectrum_data = extract_all_features(clean_dict)
        
        clean_graph = []
        for i in range(0, length, downsample):
            clean_graph.append({
                "time": float(timestamps[i]),
                "T7": float(clean_dict["T7"][i]),
                "F8": float(clean_dict["F8"][i])
            })

        return {
            "raw_graph": raw_graph,     
            "clean_graph": clean_graph, 
            "raw_stats": raw_stats,    
            "features": feats,
            "spectrum_data": spectrum_data,
            "asymmetry_score": feats.get('Alpha_Asymmetry', 0),
            "duration": len(df)/FS
        }

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

# from fastapi import FastAPI, UploadFile, File
# from fastapi.middleware.cors import CORSMiddleware
# import pandas as pd
# import numpy as np
# from scipy.signal import butter, iirnotch, filtfilt, welch
# import pywt 
# import io
# import traceback

# # Sampling Frequency (Hz)
# FS = 200.0  

# app = FastAPI()

# # CORS for frontend access
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"], 
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # 1. SIGNAL CLEANING 
# def clean_signal_data(data_dict):
#     """
#     Applies Digital Signal Processing (DSP) to remove noise.
#     1. Notch Filter (50Hz): Removes power line hum.
#     2. Bandpass Filter (0.5-50Hz): Isolates brainwaves.
#     """
#     b_notch, a_notch = iirnotch(50.0, 30.0, fs=FS)
    
#     nyquist = 0.5 * FS
#     b_band, a_band = butter(4, [0.5/nyquist, 50.0/nyquist], btype='band')
    
#     clean_dict = {}
    
#     for channel, raw_signal in data_dict.items():
#         try:
#             raw_signal = np.nan_to_num(raw_signal, nan=0.0, posinf=0.0, neginf=0.0)

#             # Filters
#             filtered = filtfilt(b_notch, a_notch, raw_signal)
#             clean_signal = filtfilt(b_band, a_band, filtered)
            
#             clean_dict[channel] = clean_signal
#         except Exception as e:
#             print(f"Skipping {channel} due to filter error: {e}")
#             clean_dict[channel] = raw_signal 
            
#     return clean_dict

# # 2. FEATURE EXTRACTION 
# def extract_all_features(clean_dict):
#     features = {}
#     spectrum_data = [] 
    
#     target_channels = ['T7', 'F8']

#     for channel in target_channels:
#         if channel not in clean_dict: continue
        
#         signal = clean_dict[channel]
        
#         signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)
        
#         # A. STATISTICAL FEATURES
#         features[f'{channel}_Mean'] = float(np.mean(signal))
#         features[f'{channel}_Std'] = float(np.std(signal)) 
#         features[f'{channel}_Max'] = float(np.max(signal))
#         features[f'{channel}_Min'] = float(np.min(signal))

#         # B. POWER SPECTRAL DENSITY (PSD)
#         # welch() to compute the power at each frequency
#         freqs, psd = welch(signal, fs=FS, nperseg=int(FS*2))
        
#         # Dominant Frequency
#         peak_idx = np.argmax(psd)
#         dominant_freq = freqs[peak_idx]
#         features[f'{channel}_DominantFreq'] = float(dominant_freq)

#         # C. BAND POWERS (Area Under Curve)
#         bands = {'Delta': (0.5, 4), 'Theta': (4, 8), 'Alpha': (8, 12), 'Beta': (12, 30), 'Gamma': (30, 40)}
#         for band_name, (low, high) in bands.items():
#             idx = np.logical_and(freqs >= low, freqs <= high)
#             features[f'{channel}_{band_name}'] = float(np.trapz(psd[idx], freqs[idx]))

#         # D. WAVELET ENERGY
#         try:
#             coeffs = pywt.wavedec(signal, 'db4', level=4)
#             energy = sum([np.sum(np.square(c)) for c in coeffs])
#             features[f'{channel}_WaveletEnergy'] = float(energy)
#         except:
#             features[f'{channel}_WaveletEnergy'] = 0.0

#     # GENERATING SPECTRUM DATA (For the Frequency Graph)
#     if 'T7' in clean_dict and 'F8' in clean_dict:
#         s_t7 = np.nan_to_num(clean_dict['T7'])
#         s_f8 = np.nan_to_num(clean_dict['F8'])
        
#         f_t7, psd_t7 = welch(s_t7, fs=FS, nperseg=int(FS*2))
#         f_f8, psd_f8 = welch(s_f8, fs=FS, nperseg=int(FS*2))
        
#         limit = 40 # Graph limit = 40Hz (Relevant brainwaves)
#         for i in range(len(f_t7)):
#             if f_t7[i] > limit: break
#             spectrum_data.append({
#                 "frequency": float(f_t7[i]),
#                 "T7": float(psd_t7[i]),
#                 "F8": float(psd_f8[i])
#             })

#     # CALCULATE ALPHA ASYMMETRY SCORE
#     # Formula: ln(Right Alpha) - ln(Left Alpha)
#     # Using small epsilon (1e-10) to avoid Log(0) error
#     right = features.get('F8_Alpha', 1e-10)
#     left = features.get('T7_Alpha', 1e-10)
    
#     # Handle NaN in features if extraction failed
#     if np.isnan(right): right = 1e-10
#     if np.isnan(left): left = 1e-10
    
#     features['Alpha_Asymmetry'] = float(np.log(right + 1e-10) - np.log(left + 1e-10))
    
#     return features, spectrum_data

# # 3. API ENDPOINT 
# @app.post("/analyze")
# async def analyze_eeg(file: UploadFile = File(...)):
#     print(f"📥 Received file: {file.filename}")
#     try:
#         contents = await file.read()
        
#         # 1. READ FILE (Handle comma or space separation)
#         try:
#             df = pd.read_csv(io.BytesIO(contents), header=None, sep=',', usecols=[0,1,2,3,4])
#             if df.shape[1] < 5: raise ValueError
#         except:
#             # Fallback for space-separated files
#             df = pd.read_csv(io.BytesIO(contents), header=None, sep=r'\s+', usecols=[0,1,2,3,4])

#         # Converting to numeric, force errors to NaN, drop empty rows
#         df = df.apply(pd.to_numeric, errors='coerce').dropna()
        
#         # 2. MAP COLUMNS (PhysioNet Dataset Standard)
#         data_dict = {}
#         # Col 0 is Index/Time
#         if df.shape[1] >= 5:
#             # USED CHANNELS (Hairless / Low Impedance)
#             data_dict['T7'] = df.iloc[:, 1].values 
#             data_dict['F8'] = df.iloc[:, 2].values 
            
#             # REJECTED CHANNELS (Hair / High Impedance)
#             data_dict['Cz'] = df.iloc[:, 3].values # Vertex (Top of head hair region)
#             data_dict['P4'] = df.iloc[:, 4].values # Parietal (Back right also the hair region)
        
#         # 3. CALCULATE RAW STATS 
#         raw_stats = {
#             "T7_Offset": float(np.mean(data_dict['T7'])),
#             "T7_Noise": float(np.std(data_dict['T7'])),
#             "Status": "HIGH IMPEDANCE (Cz/P4)"
#         }

#         # 4. PREPARING RAW GRAPH DATA (Downsampled for speed)
#         raw_graph = []
#         length = len(data_dict['T7'])
#         timestamps = np.arange(length) / FS
#         downsample = 10 
        
#         for i in range(0, length, downsample):
#             raw_graph.append({
#                 "time": float(timestamps[i]),
#                 "T7": float(data_dict["T7"][i]),
#                 "F8": float(data_dict["F8"][i]),
#                 "Cz": float(data_dict["Cz"][i]), # noise
#                 "P4": float(data_dict["P4"][i])  # noise
#             })

#         # 5. PROCESSING DATA
#         clean_dict = clean_signal_data(data_dict)
#         feats, spectrum_data = extract_all_features(clean_dict)
        
#         # 6. PREPARING CLEAN GRAPH DATA
#         clean_graph = []
#         for i in range(0, length, downsample):
#             clean_graph.append({
#                 "time": float(timestamps[i]),
#                 "T7": float(clean_dict["T7"][i]),
#                 "F8": float(clean_dict["F8"][i]),
#                 "Cz": 0, 
#                 "P4": 0 
#             })

#         # 7. JSON RESPONSE
#         return {
#             "raw_graph": raw_graph,     
#             "clean_graph": clean_graph, 
#             "raw_stats": raw_stats,    
#             "features": feats,
#             "spectrum_data": spectrum_data,
#             "asymmetry_score": feats.get('Alpha_Asymmetry', 0),
#             "duration": len(df)/FS
#         }

#     except Exception as e:
#         traceback.print_exc()
#         return {"error": str(e)}

