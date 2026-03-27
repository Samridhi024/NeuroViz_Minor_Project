import pandas as pd
import numpy as np

def generate_complex_eeg(filename="noisy_stressed_session.csv", duration=30, fs=200):
    samples = duration * fs
    t = np.linspace(0, duration, samples)
    
    # 1. BRAIN RHYTHMS (Stressed State)
    # Stressed = High Beta (15-30Hz) + High Right Alpha (F8 > T7)
    # T7 (Left) - Low Alpha, High Beta
    alpha_t7 = 0.4 * np.sin(2 * np.pi * 10 * t)
    beta_t7 = 1.2 * np.sin(2 * np.pi * 22 * t)
    
    # F8 (Right) - High Alpha (Signifies withdrawal/stress in FAA theory)
    alpha_f8 = 1.8 * np.sin(2 * np.pi * 10 * t) 
    beta_f8 = 1.1 * np.sin(2 * np.pi * 21 * t)

    # 2. ENVIRONMENTAL NOISE (The "Hairy" Signal)
    # 50Hz Power line interference
    hum = 0.7 * np.sin(2 * np.pi * 50 * t)
    
    # 3. SENSOR DRIFT (The "Wandering" Baseline)
    # Simulates the electrode moving slightly on the skin
    drift_t7 = np.cumsum(np.random.normal(0, 0.08, samples))
    drift_f8 = np.cumsum(np.random.normal(0, 0.08, samples))

    # 4. BIOLOGICAL ARTIFACTS (Random Spikes)
    # Eye Blinks (Large 200ms-400ms surges)
    blinks = np.zeros(samples)
    for _ in range(5):
        start = np.random.randint(0, samples - 100)
        blinks[start:start+60] += 15 * np.hanning(60) # High amplitude surge
        
    # Muscle Jitter (High frequency bursts)
    emg = np.random.normal(0, 0.5, samples)

    # ─── COMBINE EVERYTHING ───
    final_t7 = alpha_t7 + beta_t7 + hum + drift_t7 + blinks + emg
    final_f8 = alpha_f8 + beta_f8 + hum + drift_f8 + blinks + emg
    
    df = pd.DataFrame({
        'timestamps': t,
        'T7': final_t7,
        'F8': final_f8,
        'Cz': np.random.normal(0, 2, samples), # Just noise
        'P4': np.random.normal(0, 2, samples)
    })
    
    df.to_csv(filename, index=False)
    print(f"Dataset '{filename}' created with non-neutral FAA profile and heavy noise.")

generate_complex_eeg()