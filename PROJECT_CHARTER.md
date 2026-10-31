# PROJECT CHARTER

*(To be submitted by each group to the Faculty after consolidation of project scope and title)*

---

## SECTION A: PROJECT IDENTIFICATION

| Field | Details |
| :--- | :--- |
| **Course Code** | EC 402 |
| **Course Name** | Web & Interactive Software Systems |
| **Project Title** | **Bharat F1 — Interactive 3D Formula 1 Telemetry, Aerodynamics & Community Platform** |
| **Group Number** | Group 3 (Bharat F1 Team) |
| **Date** | September 11, 2026 |

---

## SECTION B: TEAM COMPOSITION

| No | Reg No | Student Name | Role | Responsibility |
| :-: | :---: | :--- | :--- | :--- |
| **1** | **250363** | **Dhruv** | **Team Lead** | **System architecture, full-stack integration, project coordination & admin portal setup** |
| **2** | **250408** | **Jaipal Singh Rathore** | **Backend Engineer** | **Flask REST API design, SQLite database schema, JWT security & authentication guard** |
| **3** | **250388** | **Harsh Yadav** | **3D Engine Lead** | **Three.js 3D F1 car model, OrbitControls, custom shaders & aerodynamic mesh rendering** |
| **4** | **250483** | **Parth** | **Telemetry & Audio Engineer** | **Web Audio API procedural V6 engine sound generator, speed/RPM telemetry & DRS simulation** |
| **5** | **250337** | **Bhavesh Kumar** | **UI/UX & Data Specialist** | **Interactive UI dashboard, community polling system, real-time analytics & admin panel** |

---

## SECTION C: PROBLEM STATEMENT (Elaborate)

* **Background**:
  High-performance motorsport engineering software and interactive telemetry visualizers require real-time 3D simulation, aerodynamic analysis, and engine acoustic feedback to educate racing enthusiasts and student engineering clubs. Traditional motorsport telemetry software is proprietary, desktop-bound, and lacks accessible web-based 3D graphics and live procedural sound generation.

* **Problem Definition**:
  Designing and implementing a 100% software-based, cross-platform web application (**Bharat F1 / BMU F1**) featuring:
  1. Interactive 3D rendering of a Formula 1 race car with component-level aerodynamic inspection (Front Wing, Monocoque, Halo, Power Unit, Rear Wing, Diffuser).
  2. Real-time procedural V6 hybrid engine sound generation synthesized via Web Audio API, tied dynamically to vehicle telemetry (speedometer, engine RPM, DRS).
  3. Role-gated community polling and voting system for club member engagement.
  4. Secure RESTful backend API with JWT authentication and an administrative portal for car specification editing and user role management.

* **Relevance and Impact**:
  Empowers student motorsport clubs (such as BML Munjal University F1 Club) and engineering teams with an open-source, web-accessible software suite. It eliminates reliance on expensive desktop software while providing interactive learning, acoustic engine synthesis, and democratic decision-making via real-time community polls.

---

## SECTION D: OBJECTIVES (In Bullet Points)

* **Primary Objectives**:
  * Render a fully interactive 3D Formula 1 vehicle using Three.js with custom Indian Tricolor livery and 8 inspectable subsystem assemblies.
  * Build a low-latency Web Audio API procedural sound synthesizer for V6 turbo-hybrid engine acoustic feedback driven by real-time speed and RPM curves.
  * Develop dynamic telemetry instrumentation including digital speedometer gauges, engine RPM sweeps, DRS activation, and race track simulation animation.
  * Engineer a secure Flask REST API backend with SQLite database persistence, JWT token security, and Bcrypt password hashing.
  * Implement a community polling module with live percentage tallies and an admin portal for user promotion and spec updates.

* **Success Criteria (Measurable)**:
  * **3D Rendering Performance**: Consistently maintains 60 FPS WebGL rendering across standard web browsers.
  * **Audio Synthesis Latency**: Less than 20 ms acoustic response during throttle/RPM sweeps.
  * **API Response Time**: Under 50 ms latency for authentication and database queries.
  * **Subsystem Coverage**: 100% telemetry detail across all 8 vehicle assemblies.
  * **Role-Based Security**: 100% enforcement of role permissions (Admin, Member, Guest) across protected endpoints.

---

## SECTION E: METHODOLOGY

### Technical Approach

| Phase | Description |
| :-: | :--- |
| **I** | **Requirements Analysis & System Architecture Design**: Define software scope, user roles, database schema (SQLite), and RESTful API endpoints. |
| **II** | **3D Engine & WebGL Scene Construction**: Build Three.js scene, camera OrbitControls, custom materials, lighting, and aerodynamic sub-assemblies. |
| **III** | **Telemetry & Audio Synthesizer Development**: Implement Web Audio API procedural audio nodes, dynamic frequency synthesis, speed/RPM gauges, and DRS controls. |
| **IV** | **Backend API & Security Implementation**: Construct Flask web server, SQLite database ORM, JWT token generation, Bcrypt password hashing, and admin guards. |
| **V** | **Dashboard & Polling Integration**: Design responsive glassmorphism UI, community voting interface, live tallies, and administrative specs editor. |
| **VI** | **Integration, Testing, and Deployment**: Conduct cross-browser testing, WebGL performance optimization, IDE launch configuration setup, and final deployment. |

### Tools and Technologies

* **Client System**: High-performance WebGL 2.0 accelerated browser runtime & stereo audio interface.
* **Backend Framework**: Python 3.14+, Flask 3.0 REST Engine, SQLite3 Database, PyJWT Security, Bcrypt Hashing.
* **Web Services**: WSGI Web Application Server, REST API HTTP endpoints, SQLite file persistence.
* **Frontend Dashboard**: HTML5, CSS3 (Glassmorphism UI design), JavaScript (ES6+), Three.js (3D WebGL Engine), OrbitControls.js.
* **Analytics & Acoustics**: Web Audio API (procedural V6 engine audio synthesizer), DOM Telemetry Gauges.

---

## SECTION F: TEAM AGREEMENT

**We, the undersigned team members, agree to:**

* ☑ Participate equally and fulfill assigned responsibilities
* ☑ Attend all scheduled meetings and discussion sessions
* ☑ Maintain honest and complete documentation
* ☑ Disclose all AI tool usage transparently
* ☑ Complete individual viva and demonstrate understanding
* ☑ Not engage in plagiarism or academic misconduct
* ☑ Resolve conflicts professionally through discussion or faculty guidance

**Consequences of non-compliance**: As per institutional academic regulations

---

## SECTION G: SIGNATURES

| No | Student Name | Reg / Enrollment No | Signature | Date |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Dhruv (Team Lead)** | **250363** | *Dhruv* | 11/09/2026 |
| **2** | **Jaipal Singh Rathore** | **250408** | *J. S. Rathore* | 11/09/2026 |
| **3** | **Harsh Yadav** | **250388** | *H. Yadav* | 11/09/2026 |
| **4** | **Parth** | **250483** | *Parth* | 11/09/2026 |
| **5** | **Bhavesh Kumar** | **250337** | *B. Kumar* | 11/09/2026 |

---
