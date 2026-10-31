# 🏎️ BMU F1 — Official BML Munjal University Formula 1 Racing Club & 3D Interactive Model

[![GitHub Profile](https://img.shields.io/badge/GitHub-AhlawatDhruv-orange?logo=github)](https://github.com/AhlawatDhruv)
[![Python 3](https://img.shields.io/badge/Backend-Flask%203.0-blue?logo=python)](app.py)
[![Three.js](https://img.shields.io/badge/3D%20Engine-Three.js-black?logo=three.js)](static/three.min.js)

BMU F1 is an interactive BML Munjal University Formula 1 racing club web application featuring an interactive 3D Formula 1 car built with Three.js (custom Indian Tricolor livery and Ashoka Chakra emblem), realistic procedural V6 hybrid engine audio synthesis (Web Audio API), telemetry instrumentation, community polling system, and a comprehensive role-based administrator portal.

**Created by**: [Dhruv Ahlawat (@AhlawatDhruv)](https://github.com/AhlawatDhruv)

---

## 🏁 Key Features

1. **🏎️ Interactive 3D F1 Challenger**:
   - Built with **Three.js** and **OrbitControls**.
   - Inspect key aerodynamic and mechanical assemblies (Front Wing, 18" Pirelli Slicks, Cockpit & Titanium Halo, Sculpted Sidepods, Hybrid V6 Power Unit, DRS Rear Wing, Venturi Diffuser).
   - Real-time telemetry: Dynamic Speedometer, Engine RPM, DRS Status.
   - Procedural Web Audio API F1 V6 turbo-hybrid engine sound generator with acceleration curve.
   - Race simulation mode with asphalt motion lines and exhaust sparks.

2. **📊 Community Polling & Voting**:
   - Role-gated voting for registered members.
   - Live vote tallies and interactive option percentage bars.
   - Guest exploration mode (read-only access).

3. **👑 Administrator Control Panel**:
   - Root Administrator: **`AhlawatDhruv`** (or `Dhruv`), default password: **`@01`**.
   - Create, publish, and delete polls.
   - View registered user roster, promote members to administrators, or demote.
   - Protected root admin safeguards.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Application
```bash
python app.py
```
Open your browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🛠️ Running in Visual Studio Code

1. Open this repository folder in VS Code.
2. Press **F5** or go to **Run and Debug** (`Ctrl+Shift+D`).
3. Select:
   - **`Python: Run Bharat F1 Flask App`** to start the Flask backend.
   - **`Launch Chrome against Bharat F1 (port 5000)`** to launch Chrome directly to `http://localhost:5000`.
   - Or run **`Bharat F1: Full Stack (Flask + Chrome)`** compound configuration.

---

## 📁 Project Structure

```
bharat-f1/
├── app.py                # Flask application, JWT authentication & REST APIs
├── database.py           # SQLite database schema initialization & admin setup
├── bharatf1.db           # SQLite database file
├── requirements.txt      # Python dependencies (flask, bcrypt, pyjwt, flask-cors)
├── .gitignore            # Git exclusion rules
├── README.md             # Project documentation
├── .vscode/
│   └── launch.json       # VS Code Debugger configuration (port 5000)
└── static/
    ├── index.html        # Main frontend interface & 3D Three.js application
    ├── three.min.js      # Three.js 3D library
    └── OrbitControls.js  # Camera orbit controls
```

---

## 👤 Author & GitHub
- **GitHub**: [@AhlawatDhruv](https://github.com/AhlawatDhruv)
- **Repository**: [https://github.com/AhlawatDhruv/bharat-f1](https://github.com/AhlawatDhruv/bharat-f1)
