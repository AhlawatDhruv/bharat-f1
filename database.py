import sqlite3
import bcrypt
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "bharatf1.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

DEFAULT_CAR_SPECS = [
    (
        "vehicle-info",
        "BMU-24 CHALLENGER",
        "VEHICLE INFO",
        "BML Munjal University • FIA Spec 2024 Formula 1 Aerodynamic Model",
        "3,420 kg total downforce @ 300 km/h",
        "798 kg (FIA minimum weight)",
        "Operating ambient: -5°C to 45°C",
        "1,025 BHP V6 Turbo-Hybrid",
        "Carbon-composite honeycomb monocoque & Grade 5 Titanium"
    ),
    (
        "front-wing",
        "Front Wing Assembly",
        "AERODYNAMICS",
        "Multi-element carbon-composite front wing generating up to 38% of total front-axle downforce. Features adjustable trailing flaps in BMU racing livery, sculpted endplates with outwash vortex channels, and titanium leading-edge skid protectors.",
        "850 kg @ 300 km/h",
        "11.2 kg",
        "35°C ambient",
        "4,200 N peak aerodynamic load",
        "Torayca T1000 Carbon Fibre & Titanium"
    ),
    (
        "tyre-front",
        "Front Wheels & Pirelli Slicks",
        "TYRES & BRAKES",
        "18-inch low-profile Pirelli P-Zero racing slicks on forged BBS magnesium-alloy gold rims. Fitted with carbon-ceramic brake discs capable of decelerating the car from 300 to 100 km/h in just 1.8 seconds with 5.2G peak deceleration force.",
        "Front Axle Load: 650 kg",
        "10.8 kg per wheel",
        "Operating window: 95°C - 105°C",
        "Braking power: 1,200 kW thermal",
        "Synthetic Elastomer & Forged Magnesium"
    ),
    (
        "cockpit",
        "Cockpit & Titanium Halo",
        "SAFETY & CHASSIS",
        "Moulded carbon monocoque survival cell tested to FIA 8860 standards. Features the Grade 5 Titanium Halo head protection structure capable of supporting a 125 kN static load (equivalent to two double-decker buses) and custom driver helmet in BMU Racing livery.",
        "-12 kg (neutral drag profile)",
        "Halo: 7.0 kg | Monocoque: 42 kg",
        "Cockpit internal: 48°C",
        "125 kN FIA impact load rating",
        "Grade 5 Aerospace Titanium & Zylon"
    ),
    (
        "sidepods",
        "Sculpted Sidepods & Inlets",
        "AERODYNAMICS & COOLING",
        "Aggressively sculpted aerodynamic sidepods featuring deep undercut channels to direct high-energy airflow toward the rear diffuser. High-efficiency aluminum core heat exchangers cool both the turbocharged ICE and hybrid ERS batteries.",
        "320 kg aerodynamic suction",
        "14.5 kg combined",
        "Radiator: 115°C water / 140°C oil",
        "Heat rejection: 45 kW thermal",
        "Pre-preg Carbon & Aluminium Core"
    ),
    (
        "engine",
        "Hybrid Power Unit & Shark Fin",
        "PROPULSION",
        "BMU 1.6-litre 90-degree V6 Turbocharged Internal Combustion Engine paired with MGU-K kinetic motor (120 kW) and MGU-H heat energy motor. Features the aerodynamic shark fin with official BMU Racing livery for yaw stability.",
        "Low center-of-gravity ballast",
        "150 kg (FIA minimum)",
        "Exhaust: 980°C | Turbo: 1050°C",
        "1,025 BHP combined (ICE 740 + ERS 285)",
        "Cast Iron / Inconel / Carbon Fibre"
    ),
    (
        "tyre-rear",
        "Rear Traction Wheels (Pirelli)",
        "TRACTION & SUSPENSION",
        "Extra-wide 405 mm Pirelli rear slick tyres providing massive longitudinal traction for over 1,000 BHP launches. Supported by pushrod-actuated rear suspension with anti-squat geometry and carbon-ceramic disc assemblies.",
        "Rear Axle Load: 1,150 kg",
        "12.6 kg per wheel",
        "Operating window: 100°C - 115°C",
        "Transmits 1,025 BHP to tarmac",
        "High-tack polymer & BBS Magnesium"
    ),
    (
        "rear-wing",
        "DRS High-Downforce Rear Wing",
        "AERODYNAMICS",
        "Dual-element high-downforce rear wing with hydraulically operated Drag Reduction System (DRS). Opens an 85 mm slot gap to reduce aerodynamic drag by 22% on straightaways, granting a +18 km/h top-speed overtaking boost.",
        "1,250 kg @ 300 km/h",
        "13.8 kg with hydraulic actuator",
        "75°C exhaust heat wash",
        "DRS response: 0.18s actuation",
        "Ultra-high Modulus Carbon Fibre"
    ),
    (
        "diffuser",
        "Ground Effect Floor & Diffuser",
        "GROUND EFFECT",
        "Full ground-effect Venturi undertray with dual 3D curved venturi tunnels expanding into an upswept rear diffuser. Generates over 60% of total vehicle downforce with minimal induced wake drag using ground effect principles.",
        "1,850 kg @ 300 km/h",
        "28.0 kg total assembly",
        "65°C underfloor air temp",
        "Ground suction: ~2.4G cornering grip",
        "Carbon honeycomb & Kevlar Skid Plank"
    )
]

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE COLLATE NOCASE NOT NULL,
            password_hash TEXT,
            role TEXT NOT NULL DEFAULT 'member',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS polls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS poll_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            poll_id INTEGER NOT NULL,
            option_text TEXT NOT NULL,
            FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            poll_id INTEGER NOT NULL,
            option_id INTEGER NOT NULL,
            voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, poll_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
            FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS car_specs (
            part_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            downforce TEXT,
            weight TEXT,
            temp TEXT,
            power TEXT,
            material TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS live_stream (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            is_live INTEGER DEFAULT 0,
            title TEXT DEFAULT 'BMU F1 Official Trackside & Pit Wall Live',
            stream_type TEXT DEFAULT 'camera',
            stream_url TEXT DEFAULT '',
            started_by INTEGER,
            started_at TIMESTAMP,
            FOREIGN KEY (started_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS live_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS game_leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            lap_time_ms INTEGER NOT NULL,
            lap_time_str TEXT NOT NULL,
            top_speed_kmh INTEGER DEFAULT 0,
            tyre_compound TEXT DEFAULT 'soft',
            aero_setup TEXT DEFAULT 'balanced',
            horse_power INTEGER DEFAULT 980,
            brake_power INTEGER DEFAULT 75,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_car_garage (
            user_id INTEGER PRIMARY KEY,
            front_wing INTEGER DEFAULT 50,
            rear_wing INTEGER DEFAULT 50,
            horse_power INTEGER DEFAULT 980,
            brake_power INTEGER DEFAULT 75,
            downforce INTEGER DEFAULT 50,
            ers_mode TEXT DEFAULT 'qualify',
            tyre_compound TEXT DEFAULT 'soft',
            livery_accent TEXT DEFAULT '#FF9933',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)

    # Ensure default live stream status row exists
    c.execute("""
        INSERT OR IGNORE INTO live_stream (id, is_live, title, stream_type, stream_url)
        VALUES (1, 0, 'BMU F1 Official Trackside & Pit Wall Live', 'camera', '')
    """)

    # Ensure AhlawatDhruv / Dhruv / @01 is always admin with fresh hash
    pw_hash = bcrypt.hashpw(b"@01", bcrypt.gensalt()).decode()
    admin_users = ["Dhruv", "AhlawatDhruv"]
    for admin_name in admin_users:
        existing = c.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (admin_name,)).fetchone()
        if not existing:
            c.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                (admin_name, pw_hash, "admin")
            )
        else:
            c.execute("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?", (pw_hash, existing["id"]))

    # Seed car specs if not present
    for spec in DEFAULT_CAR_SPECS:
        existing = c.execute("SELECT part_id FROM car_specs WHERE part_id = ?", (spec[0],)).fetchone()
        if not existing:
            c.execute("""
                INSERT INTO car_specs (part_id, title, category, description, downforce, weight, temp, power, material)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, spec)

    # Seed baseline circuit records on Jeddah Corniche if empty
    lb_cnt = c.execute("SELECT COUNT(*) FROM game_leaderboard").fetchone()[0]
    if lb_cnt == 0:
        dhruv_user = c.execute("SELECT id FROM users WHERE LOWER(username) = 'dhruv'").fetchone()
        dhruv_id = dhruv_user[0] if dhruv_user else 1
        default_laps = [
            (dhruv_id, 87842, '1:27.842', 342, 'soft', 'High Speed Low Drag'),
            (dhruv_id, 88310, '1:28.310', 338, 'soft', 'Balanced'),
            (dhruv_id, 89150, '1:29.150', 334, 'medium', 'Balanced')
        ]
        c.executemany("""
            INSERT INTO game_leaderboard (user_id, lap_time_ms, lap_time_str, top_speed_kmh, tyre_compound, aero_setup)
            VALUES (?, ?, ?, ?, ?, ?)
        """, default_laps)
        print("[DB] Seeded baseline Jeddah Corniche lap records.")

    conn.commit()
    conn.close()
    print("[DB] Initialized. Admin users verified & Car specifications ready.")

if __name__ == "__main__":
    init_db()
