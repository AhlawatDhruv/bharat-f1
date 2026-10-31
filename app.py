from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import sqlite3, bcrypt, jwt, datetime, os, functools, threading, time

from database import init_db, get_db

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

SECRET_KEY = "bharatf1_secret_key_2024_dhruv_ahlawat"

# --- JWT HELPERS --------------------------------------------------------------

def make_token(user_id, username, role):
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

def require_auth(roles=None):
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({"error": "Unauthorized"}), 401
            token = auth_header.split(" ")[1]
            try:
                payload = decode_token(token)
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Token expired"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Invalid token"}), 401
            if roles and payload["role"] not in roles:
                return jsonify({"error": "Forbidden: Admin privileges required"}), 403
            request.user = payload
            return f(*args, **kwargs)
        return wrapper
    return decorator

# --- AUTH ROUTES --------------------------------------------------------------

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if len(password) < 4:
        return jsonify({"error": "Password must be at least 4 characters"}), 400
    if username.lower() in ["dhruv", "ahlawatdhruv", "admin", "administrator", "guest"]:
        return jsonify({"error": "This username is reserved"}), 400

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'member')",
            (username, pw_hash)
        )
        db.commit()
        user = db.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,)).fetchone()
        token = make_token(user["id"], user["username"], user["role"])
        return jsonify({"token": token, "username": user["username"], "role": user["role"]})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already taken"}), 409
    finally:
        db.close()

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    db = get_db()
    # Support admin alias matching (Dhruv / AhlawatDhruv / admin / administrator)
    if username.lower() in ["dhruv", "ahlawatdhruv", "admin", "administrator"]:
        user = db.execute("SELECT * FROM users WHERE LOWER(username) IN ('dhruv', 'ahlawatdhruv')").fetchone()
    else:
        user = db.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,)).fetchone()
    db.close()

    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({"error": "Invalid username or password"}), 401

    token = make_token(user["id"], user["username"], user["role"])
    return jsonify({"token": token, "username": user["username"], "role": user["role"]})

@app.route("/api/auth/admin-login", methods=["POST"])
def admin_login():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"error": "Administrator username and password required"}), 400

    db = get_db()
    # If using admin aliases, check Dhruv / AhlawatDhruv
    if username.lower() in ["dhruv", "ahlawatdhruv", "admin", "administrator"]:
        user = db.execute("SELECT * FROM users WHERE LOWER(username) IN ('dhruv', 'ahlawatdhruv')").fetchone()
    else:
        user = db.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,)).fetchone()
    db.close()

    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({"error": "Invalid administrator credentials"}), 401

    if user["role"] != "admin":
        return jsonify({"error": "This account does not have administrator privileges"}), 403

    token = make_token(user["id"], user["username"], user["role"])
    return jsonify({"token": token, "username": user["username"], "role": "admin"})

@app.route("/api/auth/guest", methods=["POST"])
def guest():
    payload = {
        "user_id": None,
        "username": "Guest",
        "role": "guest",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=6)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return jsonify({"token": token, "username": "Guest", "role": "guest"})

# --- POLL ROUTES --------------------------------------------------------------

@app.route("/api/polls", methods=["GET"])
def get_polls():
    # Allow public view for guests/visitors; identify user vote if token provided
    auth_header = request.headers.get("Authorization", "")
    user = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            user = decode_token(token)
        except Exception:
            user = None

    db = get_db()
    polls = db.execute("SELECT * FROM polls ORDER BY created_at DESC").fetchall()
    result = []
    for poll in polls:
        options = db.execute(
            "SELECT po.id, po.option_text, COUNT(v.id) as votes "
            "FROM poll_options po LEFT JOIN votes v ON v.option_id = po.id "
            "WHERE po.poll_id = ? GROUP BY po.id", (poll["id"],)
        ).fetchall()
        user_vote = None
        if user and user.get("user_id"):
            vote = db.execute(
                "SELECT option_id FROM votes WHERE user_id = ? AND poll_id = ?",
                (user["user_id"], poll["id"])
            ).fetchone()
            if vote:
                user_vote = vote["option_id"]
        result.append({
            "id": poll["id"],
            "question": poll["question"],
            "created_at": poll["created_at"],
            "options": [{"id": o["id"], "text": o["option_text"], "votes": o["votes"]} for o in options],
            "user_vote": user_vote
        })
    db.close()
    return jsonify(result)

@app.route("/api/polls", methods=["POST"])
@require_auth(roles=["admin"])
def create_poll():
    data = request.json or {}
    question = (data.get("question") or "").strip()
    options = [o.strip() for o in (data.get("options") or []) if o.strip()]
    if not question:
        return jsonify({"error": "Question required"}), 400
    if len(options) < 2:
        return jsonify({"error": "At least 2 options required"}), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO polls (question, created_by) VALUES (?, ?)",
        (question, request.user["user_id"])
    )
    poll_id = cur.lastrowid
    for opt in options:
        db.execute("INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)", (poll_id, opt))
    db.commit()
    db.close()
    return jsonify({"message": "Poll created", "poll_id": poll_id}), 201

@app.route("/api/polls/<int:poll_id>", methods=["DELETE"])
@require_auth(roles=["admin"])
def delete_poll(poll_id):
    db = get_db()
    db.execute("DELETE FROM polls WHERE id = ?", (poll_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Poll deleted"})

@app.route("/api/polls/<int:poll_id>/vote", methods=["POST"])
@require_auth(roles=["member", "admin"])
def vote(poll_id):
    data = request.json or {}
    option_id = data.get("option_id")
    if not option_id:
        return jsonify({"error": "Option required"}), 400
    db = get_db()
    existing = db.execute(
        "SELECT id FROM votes WHERE user_id = ? AND poll_id = ?",
        (request.user["user_id"], poll_id)
    ).fetchone()
    if existing:
        db.close()
        return jsonify({"error": "Already voted in this poll"}), 409
    valid_option = db.execute(
        "SELECT id FROM poll_options WHERE id = ? AND poll_id = ?",
        (option_id, poll_id)
    ).fetchone()
    if not valid_option:
        db.close()
        return jsonify({"error": "Invalid option"}), 400
    db.execute(
        "INSERT INTO votes (user_id, poll_id, option_id) VALUES (?, ?, ?)",
        (request.user["user_id"], poll_id, option_id)
    )
    db.commit()
    db.close()
    return jsonify({"message": "Vote recorded"})


def is_main_admin(user):
    if not user:
        return False
    return user.get("username", "").strip().lower() in ["dhruv", "ahlawatdhruv"]

# --- ADMIN ROUTES -------------------------------------------------------------

@app.route("/api/admin/users", methods=["GET"])
@require_auth(roles=["admin"])
def list_users():
    db = get_db()
    users = db.execute(
        "SELECT id, username, role, created_at FROM users ORDER BY created_at ASC"
    ).fetchall()
    db.close()
    return jsonify([dict(u) for u in users])

@app.route("/api/admin/users/<int:user_id>/promote", methods=["POST"])
@require_auth(roles=["admin"])
def promote_user(user_id):
    if not is_main_admin(request.user):
        return jsonify({"error": "Forbidden: Only Main Administrator Dhruv has the authority to promote members to Administrator"}), 403

    db = get_db()
    user = db.execute("SELECT username, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        db.close()
        return jsonify({"error": "User not found"}), 404
    db.execute("UPDATE users SET role = 'admin' WHERE id = ?", (user_id,))
    db.commit()
    db.close()
    return jsonify({"message": f"{user['username']} promoted to Administrator"})

@app.route("/api/admin/users/<int:user_id>/demote", methods=["POST"])
@require_auth(roles=["admin"])
def demote_user(user_id):
    if not is_main_admin(request.user):
        return jsonify({"error": "Forbidden: Only Main Administrator Dhruv has the power to un-admin users"}), 403

    db = get_db()
    user = db.execute("SELECT username, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        db.close()
        return jsonify({"error": "User not found"}), 404
    if user["username"].lower() in ["dhruv", "ahlawatdhruv"]:
        db.close()
        return jsonify({"error": "Cannot un-admin Main Administrator Dhruv"}), 403
    db.execute("UPDATE users SET role = 'member' WHERE id = ?", (user_id,))
    db.commit()
    db.close()
    return jsonify({"message": f"{user['username']} un-admined and returned to Member role"})

# --- CAR SPECIFICATIONS ROUTES ------------------------------------------------

@app.route("/api/car-specs", methods=["GET"])
def get_car_specs():
    db = get_db()
    rows = db.execute("SELECT * FROM car_specs ORDER BY rowid ASC").fetchall()
    db.close()

    parts = {}
    vehicle = {
        "title": "BMU-24 CHALLENGER",
        "subtitle": "BML Munjal University • FIA Spec 2024 Formula 1 Aerodynamic Model"
    }

    for r in rows:
        d = dict(r)
        pid = d["part_id"]
        if pid == "vehicle-info":
            vehicle = {
                "title": d["title"],
                "subtitle": d["description"],
                "downforce": d["downforce"] or "",
                "weight": d["weight"] or "",
                "temp": d["temp"] or "",
                "power": d["power"] or "",
                "material": d["material"] or ""
            }
        else:
            parts[pid] = {
                "part_id": pid,
                "title": d["title"],
                "category": d["category"],
                "desc": d["description"],
                "specs": {
                    "downforce": d["downforce"] or "",
                    "weight": d["weight"] or "",
                    "temp": d["temp"] or "",
                    "power": d["power"] or "",
                    "material": d["material"] or ""
                },
                "updated_at": d.get("updated_at")
            }

    return jsonify({"vehicle": vehicle, "parts": parts})

@app.route("/api/admin/car-specs/vehicle-info", methods=["PUT", "POST"])
@require_auth(roles=["admin"])
def update_vehicle_info():
    data = request.json or {}
    title = (data.get("title") or "").strip()
    subtitle = (data.get("subtitle") or data.get("description") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    db = get_db()
    db.execute("""
        UPDATE car_specs
        SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE part_id = 'vehicle-info'
    """, (title, subtitle))
    db.commit()
    db.close()
    return jsonify({"message": "Vehicle information updated", "vehicle": {"title": title, "subtitle": subtitle}})

@app.route("/api/admin/car-specs/<string:part_id>", methods=["PUT", "POST"])
@require_auth(roles=["admin"])
def update_car_spec(part_id):
    data = request.json or {}
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    description = (data.get("desc") or data.get("description") or "").strip()
    specs = data.get("specs") or {}
    downforce = specs.get("downforce", data.get("downforce", ""))
    weight = specs.get("weight", data.get("weight", ""))
    temp = specs.get("temp", data.get("temp", ""))
    power = specs.get("power", data.get("power", ""))
    material = specs.get("material", data.get("material", ""))

    if not title:
        return jsonify({"error": "Title is required"}), 400

    db = get_db()
    existing = db.execute("SELECT part_id FROM car_specs WHERE part_id = ?", (part_id,)).fetchone()
    if not existing:
        db.execute("""
            INSERT INTO car_specs (part_id, title, category, description, downforce, weight, temp, power, material)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (part_id, title, category, description, downforce, weight, temp, power, material))
    else:
        db.execute("""
            UPDATE car_specs
            SET title = ?, category = ?, description = ?, downforce = ?, weight = ?, temp = ?, power = ?, material = ?, updated_at = CURRENT_TIMESTAMP
            WHERE part_id = ?
        """, (title, category, description, downforce, weight, temp, power, material, part_id))
    db.commit()
    row = db.execute("SELECT * FROM car_specs WHERE part_id = ?", (part_id,)).fetchone()
    db.close()

    d = dict(row)
    updated_part = {
        "part_id": d["part_id"],
        "title": d["title"],
        "category": d["category"],
        "desc": d["description"],
        "specs": {
            "downforce": d["downforce"],
            "weight": d["weight"],
            "temp": d["temp"],
            "power": d["power"],
            "material": d["material"]
        }
    }
    return jsonify({"message": f"Updated specifications for {title}", "part": updated_part})


# In-memory device camera frame buffer
latest_live_frame = None
latest_frame_time = 0
frame_lock = threading.Lock()

# --- LIVE STREAMING & COMMENTARY ROUTES ---------------------------------------

@app.route("/api/live/status", methods=["GET"])
def get_live_status():
    db = get_db()
    stream = db.execute("""
        SELECT ls.id, ls.is_live, ls.title, ls.stream_type, ls.stream_url, ls.started_at,
               u.username as host_name
        FROM live_stream ls
        LEFT JOIN users u ON ls.started_by = u.id
        WHERE ls.id = 1
    """).fetchone()

    comments_count = db.execute("SELECT COUNT(*) as cnt FROM live_comments").fetchone()["cnt"]
    db.close()

    if not stream:
        return jsonify({
            "is_live": False,
            "title": "BMU F1 Official Trackside & Pit Wall Live",
            "stream_type": "camera",
            "stream_url": "",
            "started_at": None,
            "host_name": "Dhruv (Root Admin)",
            "comments_count": comments_count
        })

    d = dict(stream)
    return jsonify({
        "is_live": bool(d["is_live"]),
        "title": d["title"],
        "stream_type": d["stream_type"],
        "stream_url": d["stream_url"] or "",
        "started_at": d["started_at"],
        "host_name": d["host_name"] or "Dhruv (Root Admin)",
        "comments_count": comments_count
    })

@app.route("/api/live/start", methods=["POST"])
@require_auth(roles=["admin"])
def start_live_stream():
    data = request.json or {}
    title = (data.get("title") or "").strip() or "BMU F1 Trackside & Pit Wall Live"
    stream_type = data.get("stream_type", "camera")
    stream_url = (data.get("stream_url") or "").strip()

    db = get_db()
    db.execute("""
        UPDATE live_stream
        SET is_live = 1,
            title = ?,
            stream_type = ?,
            stream_url = ?,
            started_by = ?,
            started_at = CURRENT_TIMESTAMP
        WHERE id = 1
    """, (title, stream_type, stream_url, request.user["user_id"]))
    db.commit()
    db.close()
    return jsonify({
        "message": "Live stream started",
        "is_live": True,
        "title": title,
        "stream_type": stream_type,
        "stream_url": stream_url
    })

@app.route("/api/live/stop", methods=["POST"])
@require_auth(roles=["admin"])
def stop_live_stream():
    db = get_db()
    global latest_live_frame, latest_frame_time
    with frame_lock:
        latest_live_frame = None
        latest_frame_time = 0
    db.execute("UPDATE live_stream SET is_live = 0 WHERE id = 1")
    db.commit()
    db.close()
    return jsonify({"message": "Live stream ended", "is_live": False})


@app.route("/api/live/stream/frame", methods=["POST"])
@require_auth(roles=["admin"])
def upload_live_frame():
    global latest_live_frame, latest_frame_time
    frame_data = request.get_data()
    if frame_data:
        with frame_lock:
            latest_live_frame = frame_data
            latest_frame_time = time.time()
        return jsonify({"status": "ok"}), 200
    return jsonify({"error": "No frame data"}), 400

@app.route("/api/live/stream/frame/latest")
def get_latest_live_frame():
    global latest_live_frame, latest_frame_time
    with frame_lock:
        frame = latest_live_frame
        age = (time.time() - latest_frame_time) if latest_live_frame else 999
    if frame and age < 6.0:
        return Response(frame, mimetype="image/jpeg", headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        })
    return jsonify({"error": "No active frame"}), 404

@app.route("/api/live/comments", methods=["GET"])
def get_live_comments():
    db = get_db()
    rows = db.execute("""
        SELECT lc.id, lc.user_id, lc.message, lc.created_at, u.username, u.role
        FROM live_comments lc
        JOIN users u ON lc.user_id = u.id
        ORDER BY lc.id ASC
        LIMIT 150
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/live/comments", methods=["POST"])
@require_auth()
def post_live_comment():
    data = request.json or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Comment cannot be empty"}), 400
    if len(message) > 500:
        return jsonify({"error": "Comment exceeds 500 characters"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "INSERT INTO live_comments (user_id, message) VALUES (?, ?)",
        (request.user["user_id"], message)
    )
    db.commit()
    comment_id = cur.lastrowid
    row = db.execute("""
        SELECT lc.id, lc.user_id, lc.message, lc.created_at, u.username, u.role
        FROM live_comments lc
        JOIN users u ON lc.user_id = u.id
        WHERE lc.id = ?
    """, (comment_id,)).fetchone()
    db.close()
    return jsonify(dict(row)), 201

@app.route("/api/live/comments/<int:comment_id>", methods=["DELETE"])
@require_auth(roles=["admin"])
def delete_live_comment(comment_id):
    db = get_db()
    db.execute("DELETE FROM live_comments WHERE id = ?", (comment_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Comment deleted"})

@app.route("/api/live/comments", methods=["DELETE"])
@require_auth(roles=["admin"])
def clear_all_live_comments():
    db = get_db()
    db.execute("DELETE FROM live_comments")
    db.commit()
    db.close()
    return jsonify({"message": "All live comments cleared"})

# --- JEDDAH CORNICHE RACING GAME & LEADERBOARD ROUTES -------------------------

def format_lap_time(ms):
    mins = int(ms // 60000)
    secs = int((ms % 60000) // 1000)
    millis = int(ms % 1000)
    return f"{mins}:{secs:02d}.{millis:03d}"

@app.route("/api/game/leaderboard", methods=["GET"])
def get_game_leaderboard():
    db = get_db()
    pr_only = request.args.get("pr", "true").lower() == "true"
    
    if pr_only:
        # Scoreboard for every participant's Personal Record (PR)
        rows = db.execute("""
            SELECT gl.id, gl.user_id, gl.lap_time_ms, gl.lap_time_str, gl.top_speed_kmh,
                   gl.tyre_compound, gl.aero_setup, COALESCE(gl.horse_power, 980) as horse_power,
                   COALESCE(gl.brake_power, 75) as brake_power, gl.created_at,
                   u.username, u.role
            FROM game_leaderboard gl
            JOIN (
                SELECT user_id, MIN(lap_time_ms) as min_lap
                FROM game_leaderboard
                GROUP BY user_id
            ) best ON gl.user_id = best.user_id AND gl.lap_time_ms = best.min_lap
            JOIN users u ON gl.user_id = u.id
            GROUP BY gl.user_id
            ORDER BY gl.lap_time_ms ASC
            LIMIT 30
        """).fetchall()
    else:
        rows = db.execute("""
            SELECT gl.id, gl.user_id, gl.lap_time_ms, gl.lap_time_str, gl.top_speed_kmh,
                   gl.tyre_compound, gl.aero_setup, COALESCE(gl.horse_power, 980) as horse_power,
                   COALESCE(gl.brake_power, 75) as brake_power, gl.created_at,
                   u.username, u.role
            FROM game_leaderboard gl
            JOIN users u ON gl.user_id = u.id
            ORDER BY gl.lap_time_ms ASC
            LIMIT 30
        """).fetchall()
    db.close()

    result = []
    for rank, r in enumerate(rows, 1):
        d = dict(r)
        d["rank"] = rank
        result.append(d)
    return jsonify(result)

@app.route("/api/game/lap-time", methods=["POST"])
def submit_lap_time():
    data = request.json or {}
    lap_ms = int(data.get("lap_time_ms") or 0)
    top_speed = int(data.get("top_speed_kmh") or 0)
    tyre = (data.get("tyre_compound") or "soft").strip().lower()
    aero = (data.get("aero_setup") or "balanced").strip()
    horse_power = max(700, min(1200, int(data.get("horse_power") or 980)))
    brake_power = max(40, min(100, int(data.get("brake_power") or 75)))

    # Minimum physically plausible F1 lap time on Jeddah (~80s pole, reject < 35s)
    if lap_ms < 35000 or lap_ms > 600000:
        return jsonify({"error": "Invalid lap time recorded"}), 400

    # Determine user identity (supports authenticated members/admins or guest fallback)
    auth_header = request.headers.get("Authorization", "")
    user_id = None
    if auth_header.startswith("Bearer "):
        try:
            payload = decode_token(auth_header.split(" ")[1])
            user_id = payload.get("user_id")
        except Exception:
            user_id = None

    db = get_db()
    if not user_id:
        # Check or create default Guest racer user
        guest_u = db.execute("SELECT id FROM users WHERE LOWER(username) = 'guest racer'").fetchone()
        if not guest_u:
            cur = db.execute("INSERT INTO users (username, role) VALUES ('Guest Racer', 'member')")
            db.commit()
            user_id = cur.lastrowid
        else:
            user_id = guest_u["id"]

    lap_str = format_lap_time(lap_ms)
    cur = db.cursor()
    cur.execute("""
        INSERT INTO game_leaderboard (user_id, lap_time_ms, lap_time_str, top_speed_kmh, tyre_compound, aero_setup, horse_power, brake_power)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, lap_ms, lap_str, top_speed, tyre, aero, horse_power, brake_power))
    db.commit()
    new_id = cur.lastrowid

    # Check if this is the user's personal record
    prev_best = db.execute("SELECT MIN(lap_time_ms) FROM game_leaderboard WHERE user_id = ? AND id != ?", (user_id, new_id)).fetchone()[0]
    is_pr = (prev_best is None) or (lap_ms < prev_best)

    # Calculate leaderboard rank
    rank = db.execute("SELECT COUNT(DISTINCT user_id) FROM game_leaderboard WHERE lap_time_ms < ?", (lap_ms,)).fetchone()[0] + 1
    db.close()

    return jsonify({
        "message": "Lap time recorded!",
        "rank": rank,
        "lap_time_ms": lap_ms,
        "lap_time_str": lap_str,
        "is_pr": is_pr,
        "is_record": rank == 1
    }), 201

@app.route("/api/game/garage", methods=["GET"])
@require_auth()
def get_garage():
    db = get_db()
    row = db.execute("SELECT * FROM user_car_garage WHERE user_id = ?", (request.user["user_id"],)).fetchone()
    db.close()
    if not row:
        return jsonify({
            "front_wing": 50,
            "rear_wing": 50,
            "horse_power": 980,
            "brake_power": 75,
            "downforce": 50,
            "ers_mode": "qualify",
            "tyre_compound": "soft",
            "livery_accent": "#FF9933"
        })
    d = dict(row)
    if "horse_power" not in d or d["horse_power"] is None: d["horse_power"] = 980
    if "brake_power" not in d or d["brake_power"] is None: d["brake_power"] = 75
    if "downforce" not in d or d["downforce"] is None: d["downforce"] = 50
    return jsonify(d)

@app.route("/api/game/garage", methods=["POST"])
@require_auth()
def save_garage():
    data = request.json or {}
    front_wing = max(0, min(100, int(data.get("front_wing", 50))))
    rear_wing = max(0, min(100, int(data.get("rear_wing", 50))))
    horse_power = max(700, min(1200, int(data.get("horse_power", 980))))
    brake_power = max(40, min(100, int(data.get("brake_power", 75))))
    downforce = max(10, min(100, int(data.get("downforce", 50))))
    ers_mode = str(data.get("ers_mode", "qualify")).strip().lower()
    tyre = str(data.get("tyre_compound", "soft")).strip().lower()
    livery = str(data.get("livery_accent", "#FF9933")).strip()

    db = get_db()
    db.execute("""
        INSERT INTO user_car_garage (user_id, front_wing, rear_wing, horse_power, brake_power, downforce, ers_mode, tyre_compound, livery_accent, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            front_wing = excluded.front_wing,
            rear_wing = excluded.rear_wing,
            horse_power = excluded.horse_power,
            brake_power = excluded.brake_power,
            downforce = excluded.downforce,
            ers_mode = excluded.ers_mode,
            tyre_compound = excluded.tyre_compound,
            livery_accent = excluded.livery_accent,
            updated_at = CURRENT_TIMESTAMP
    """, (request.user["user_id"], front_wing, rear_wing, horse_power, brake_power, downforce, ers_mode, tyre, livery))
    db.commit()
    db.close()
    return jsonify({"message": "Garage configuration saved successfully!"})


# --- SERVE FRONTEND -----------------------------------------------------------

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

# --- MAIN ---------------------------------------------------------------------

# Initialize database schema if not present (works for both direct run and WSGI/Gunicorn)
init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("[SERVER] BMU F1 running:")
    print(f"  -> http://127.0.0.1:{port} (Direct IPv4 - Recommended)")
    print(f"  -> http://localhost:{port}")
    app.run(debug=True, host="0.0.0.0", port=port)
