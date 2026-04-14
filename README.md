# NeuroViz: Browser-Native EEG Analysis Platform

**NeuroViz** is an open-source, hardware-independent platform designed to bridge the gap between clinical EEG processing and patient-centric wellness insights. It provides a full Digital Signal Processing (DSP) pipeline directly in the browser, eliminating the need for expensive desktop software or proprietary hardware.

## 🚀 Key Features
* **Dual-Mode Interface**: A single-toggle system that switches between a high-density **Clinician Dashboard** and a plain-English **Patient Wellness View**.
* **Full DSP Pipeline**: Automated cleaning including Detrending, Notch filtering (50Hz), Butterworth Bandpass (0.5–45Hz), and Z-score Normalization.
* **FAA Computation**: Real-time calculation of Frontal Alpha Asymmetry to assess emotional valence and engagement.
* **3D Brain Topography**: Interactive Three.js-based 3D sensor mapping for real-time electrode health visualization.
* **Artifact Detection**: Heuristic-based detection for Eye Blinks (EOG), Muscle noise (EMG), and motion artifacts.

## 🛠️ Tech Stack
* **Frontend**: React.js, Three.js (React Three Fiber), Recharts, Bootstrap 5, Lucide-React.
* **Backend**: FastAPI (Python), MNE-Python (EDF handling), Pandas (CSV/TXT handling), SciPy, NumPy.
* **Communication**: RESTful API (JSON-based communication).

## 🧠 Scientific Methodology

### Frontal Alpha Asymmetry (FAA)
The core of the Patient Wellness view is the FAA score, a validated clinical biomarker for emotional motivation:
* **Formula**: $ln(\text{Right Alpha Power}) - ln(\text{Left Alpha Power})$.
* **Interpretation**: Positive scores indicate left-hemisphere dominance (Engagement/Proactive), while negative scores indicate right-hemisphere dominance (Stress/Reflective).

### Z-Score Normalization
To ensure hardware independence (OpenBCI, Muse, or Clinical EDF), all signals are standardized:
* **Method**: $(x - \mu) / \sigma$.
* **Result**: Every channel is transformed to a Mean of 0 and a Standard Deviation of 1, allowing for consistent thresholding across different devices.

## 🏗️ System Architecture
1.  **Ingestion**: Supports `.edf` (via MNE) and `.csv` or `.txt` (via Pandas).
2.  **Processing**: A 5-step pipeline (NaN handling, Detrend, Notch, Bandpass, Z-score) cleans the signal.
3.  **Extraction**: Extracting 20+ features, including Statistical metrics, Welch PSD, and Alpha Power.
4.  **Delivery**: A single JSON blob powers both dashboard modes simultaneously with zero re-computation.

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

