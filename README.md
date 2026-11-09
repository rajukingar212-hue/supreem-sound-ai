# SUPREEM SOUND AI
## AI-Powered Automated Video Sound Design & Batch Processing Platform

Supreem Sound AI is an enterprise-grade automated audio post-production platform. It transforms uploaded videos into professionally sound-designed productions by stripping unwanted original audio (music, speech, ambient chatter) and generating realistic, diegetic environmental and object sound effects placed onto independent, synchronized audio stems.

---

## 🎯 Normative Creator Specifications & Client Guarantees

Conforming strictly to **Creator Requirements.pdf**:

1. **Audio Format**:
   - Master and every stem exported as **WAV format**, **48 kHz sample rate**, **24-bit PCM**, **Stereo (2 channels)**.
   - Exact presentation duration: **10.000 seconds = exactly 480,000 samples per channel**.

2. **Mixdown Requirements**:
   - Mixdown True Peak strictly $\le -1.0\text{ dBTP}$ (target $\approx -3.5\text{ dBTP}$ using 4x oversampled ITU-R BS.1770-4 metering).
   - Zero digital clipping ($\max(|x|) < 1.0$).
   - Summation Contract: $\sum \text{Stems} = \text{Mixdown.wav}$ reproduced within 24-bit PCM quantization tolerance ($\epsilon < 10^{-5}$).

3. **Stem Requirements**:
   - Minimum **3 individual, non-empty, non-duplicate stems** (e.g., Ambience, Foley/Footsteps, Impacts/Mechanisms).
   - Descriptive English filenames matching acoustic content (e.g., `desert_ambience.wav`, `footsteps_on_sand.wav`, `metal_object_impact.wav`).
   - Identical duration and alignment starting at sample zero.

4. **Original Audio Removal Policy**:
   - **`REPLACE ALL ORIGINAL AUDIO = ENABLED`** by default.
   - Any source audio (music, dialogue, voices, noise) is detected, classified, and stripped cleanly (`-an`) before sound design.
   - Final MP4 contains **only** the newly generated sound design.

5. **Prohibited Elements**:
   - STRICTLY NO background music, songs, melodies, speech, dialogue, vocal screaming, breathing, or human vocalizations.

6. **Delivery Package Structure**:
   ```
   <basename>.zip
   ├── <original_basename>.mp4
   ├── Mixdown.wav
   ├── Stems/
   │   ├── stem_01_ambience.wav
   │   ├── stem_02_foley.wav
   │   └── stem_03_impact.wav
   └── metadata.json
   ```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.12+ (tested on Python 3.15)
- Node.js 20+ (tested on Node.js 24)
- FFmpeg & FFprobe (automatically bundled or system PATH)

### 2. Backend Setup
```bash
# Navigate to backend and install dependencies
cd backend
pip install -r requirements.txt

# Start FastAPI backend server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API is now running at `http://localhost:8000`.
Swagger API Docs available at `http://localhost:8000/docs`.

### 3. Frontend Setup
```bash
# In a separate terminal:
cd frontend
npm install --legacy-peer-deps
npm run dev
```
The Next.js SaaS dashboard is now running at `http://localhost:3000`.

---

## 🧪 Automated Test Suite (100% Pass Rate)

Run the comprehensive pytest test suite covering:
- Original audio detection & classification (silence, music, speech, ambience, mixed)
- FFmpeg stream inspection and complete original audio stripping
- 48 kHz, 24-bit stereo sample-accurate DSP stem synthesis
- Mixdown summation reproduction and ITU-R BS.1770-4 true peak metering
- Multi-tier automated Quality Control (QC) engine
- Deterministic ZIP archive packaging and metadata generation
- **All 6 Test Fixtures** (Fixture A through F) end-to-end:

```bash
# Set PYTHONPATH and run pytest
$env:PYTHONPATH = "D:\AI VIDEO EDITOR\backend"
python -m pytest backend/tests -v
```

---

## 🐳 Docker Deployment

To spin up the entire multi-container production stack (PostgreSQL, Redis, FastAPI Backend, Next.js Frontend):

```bash
# Configure API keys in .env
cp .env.example .env

# Launch with Docker Compose
docker-compose up --build -d
```
Access the application at `http://localhost:3000`.

---

## 📄 Normative Reference & Examples Discrepancy Note

In `Good examples.zip`, some legacy reference files included stems labeled `screaming.wav` or vocal effects. As mandated by the Master Development Prompt:
> *"Use the supplied Creator Requirements.pdf as the normative client specification... When examples conflict with the latest written requirements, prioritize the explicit written requirements."*

Supreem Sound AI strictly enforces zero human voices, zero screaming, and zero vocal sounds across all analysis, prompt generation, and QC verification filters.

