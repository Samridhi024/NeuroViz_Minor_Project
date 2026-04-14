# NeuroViz: Browser-Native EEG Analysis Platform

**NeuroViz** is an open-source, hardware-independent platform designed to bridge the gap between clinical EEG processing and patient-centric wellness insights[cite: 1, 132]. [cite_start]It provides a full Digital Signal Processing (DSP) pipeline directly in the browser, eliminating the need for expensive desktop software or proprietary hardware[cite: 24, 162].

## 🚀 Key Features
**Dual-Mode Interface**: A single-toggle system that switches between a high-density **Clinician Dashboard** and a plain-English **Patient Wellness View**[cite: 145, 146].
**Full DSP Pipeline**: Automated cleaning including Detrending, Notch filtering (50Hz), Butterworth Bandpass (0.5–45Hz), and Z-score Normalization[cite: 137, 185].
* [cite_start]**FAA Computation**: Real-time calculation of Frontal Alpha Asymmetry to assess emotional valence and engagement[cite: 153, 154].
* [cite_start]**3D Brain Topography**: Interactive Three.js-based 3D sensor mapping for real-time electrode health visualization[cite: 158, 159].
* [cite_start]**Artifact Detection**: Heuristic-based detection for Eye Blinks (EOG), Muscle noise (EMG), and motion artifacts[cite: 147, 148].

## 🛠️ Tech Stack
* [cite_start]**Frontend**: React.js, Three.js (React Three Fiber), Recharts, Bootstrap 5, Lucide-React[cite: 140, 141].
* [cite_start]**Backend**: FastAPI (Python), MNE-Python (EDF handling), Pandas (CSV/TXT handling), SciPy, NumPy[cite: 138, 139].
* [cite_start]**Communication**: RESTful API (JSON-based communication)[cite: 139, 180].

## 🧠 Scientific Methodology

### Frontal Alpha Asymmetry (FAA)
[cite_start]The core of the Patient Wellness view is the FAA score, a validated clinical biomarker for emotional motivation[cite: 153, 260]:
* [cite_start]**Formula**: $ln(\text{Right Alpha Power}) - ln(\text{Left Alpha Power})$[cite: 48, 259].
* [cite_start]**Interpretation**: Positive scores indicate left-hemisphere dominance (Engagement/Proactive), while negative scores indicate right-hemisphere dominance (Stress/Reflective)[cite: 155, 156, 260].

### Z-Score Normalization
[cite_start]To ensure hardware independence (OpenBCI, Muse, or Clinical EDF), all signals are standardized[cite: 203, 227]:
* [cite_start]**Method**: $(x - \mu) / \sigma$[cite: 204, 232].
* [cite_start]**Result**: Every channel is transformed to a Mean of 0 and a Standard Deviation of 1, allowing for consistent thresholding across different devices[cite: 205, 233].

## 🏗️ System Architecture
1.  [cite_start]**Ingestion**: Supports `.edf` (via MNE) and `.csv` or `.txt` (via Pandas)[cite: 139, 170].
2.  [cite_start]**Processing**: A 5-step pipeline (NaN handling, Detrend, Notch, Bandpass, Z-score) cleans the signal[cite: 185, 207].
3.  [cite_start]**Extraction**: Extracting 20+ features, including Statistical metrics, Welch PSD, and Alpha Power[cite: 176, 234].
4.  [cite_start]**Delivery**: A single JSON blob powers both dashboard modes simultaneously with zero re-computation[cite: 180, 181].

## 📦 Installation & Setup

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (React)
```bash
cd frontend
npm install
npm start
```

