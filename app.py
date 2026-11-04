import threading
from datetime import datetime
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

lock = threading.Lock()

# Task management in-memory store
task_id_counter = 3
tasks = [
    {
        "id": 1,
        "title": "Cloud Computing Assignment",
        "description": "Containerize Flask application with Docker and prepare Kubernetes manifests.",
        "deadline": "2026-11-10",
        "status": "pending",
        "completed": False,
        "created_at": "2026-11-04T10:00:00"
    },
    {
        "id": 2,
        "title": "Review Kubernetes Architecture",
        "description": "Study Pods, Deployments, Services, and NodePort networking concepts.",
        "deadline": "2026-11-06",
        "status": "completed",
        "completed": True,
        "created_at": "2026-11-04T09:00:00"
    }
]

# Class schedule in-memory store
class_id_counter = 4
classes = [
    {
        "id": 1,
        "subject": "Distributed Systems",
        "code": "CS401",
        "class_num": "Lecture 08",
        "block": "Turing Academic Block",
        "room": "Room 302",
        "start_time": "09:30",
        "end_time": "11:00",
        "days": ["Monday", "Wednesday", "Friday"],
        "faculty": "Prof. Katherine Johnson"
    },
    {
        "id": 2,
        "subject": "Cloud Architecture & DevOps",
        "code": "CS408",
        "class_num": "Lab 04",
        "block": "Von Neumann Complex",
        "room": "Lab 204",
        "start_time": "11:30",
        "end_time": "13:00",
        "days": ["Monday", "Wednesday"],
        "faculty": "Dr. Alan Turing"
    },
    {
        "id": 3,
        "subject": "Algorithm Analysis & Design",
        "code": "CS302",
        "class_num": "Lecture 12",
        "block": "Ramanujan Hall",
        "room": "Seminar Hall A",
        "start_time": "14:00",
        "end_time": "15:30",
        "days": ["Tuesday", "Thursday"],
        "faculty": "Dr. Grace Hopper"
    }
]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"}), 200

# ==================== TASKS API ====================

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    with lock:
        return jsonify(tasks), 200

@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400
    
    title = str(data.get("title", "")).strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    
    description = str(data.get("description", "")).strip()
    deadline = str(data.get("deadline", "")).strip()

    global task_id_counter
    with lock:
        new_task = {
            "id": task_id_counter,
            "title": title,
            "description": description,
            "deadline": deadline,
            "status": "pending",
            "completed": False,
            "created_at": datetime.now().isoformat()
        }
        task_id_counter += 1
        tasks.append(new_task)
        return jsonify(new_task), 201

@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400
    
    with lock:
        task = next((t for t in tasks if t["id"] == task_id), None)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        
        if "completed" in data:
            task["completed"] = bool(data["completed"])
            task["status"] = "completed" if task["completed"] else "pending"
        elif "status" in data:
            status_val = str(data["status"]).lower()
            task["status"] = "completed" if status_val == "completed" else "pending"
            task["completed"] = (task["status"] == "completed")
            
        if "title" in data:
            title_val = str(data["title"]).strip()
            if title_val:
                task["title"] = title_val
        if "description" in data:
            task["description"] = str(data["description"]).strip()
        if "deadline" in data:
            task["deadline"] = str(data["deadline"]).strip()
            
        return jsonify(task), 200

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    global tasks
    with lock:
        task = next((t for t in tasks if t["id"] == task_id), None)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        tasks = [t for t in tasks if t["id"] != task_id]
        return jsonify({"message": "Task deleted successfully", "id": task_id}), 200

# ==================== CLASSES API ====================

@app.route("/api/classes", methods=["GET"])
def get_classes():
    with lock:
        return jsonify(classes), 200

@app.route("/api/classes", methods=["POST"])
def create_class():
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400

    subject = str(data.get("subject", "")).strip()
    if not subject:
        return jsonify({"error": "Subject name is required"}), 400

    code = str(data.get("code", "")).strip()
    class_num = str(data.get("class_num", "")).strip()
    block = str(data.get("block", "")).strip()
    room = str(data.get("room", "")).strip()
    start_time = str(data.get("start_time", "")).strip()
    end_time = str(data.get("end_time", "")).strip()
    days = data.get("days", [])
    if isinstance(days, str):
        days = [d.strip() for d in days.split(",") if d.strip()]
    faculty = str(data.get("faculty", "")).strip()

    global class_id_counter
    with lock:
        new_class = {
            "id": class_id_counter,
            "subject": subject,
            "code": code,
            "class_num": class_num,
            "block": block,
            "room": room,
            "start_time": start_time,
            "end_time": end_time,
            "days": days,
            "faculty": faculty,
            "created_at": datetime.now().isoformat()
        }
        class_id_counter += 1
        classes.append(new_class)
        return jsonify(new_class), 201

@app.route("/api/classes/<int:class_id>", methods=["PATCH"])
def update_class(class_id):
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400

    with lock:
        cls = next((c for c in classes if c["id"] == class_id), None)
        if not cls:
            return jsonify({"error": "Class not found"}), 404

        if "subject" in data and str(data["subject"]).strip():
            cls["subject"] = str(data["subject"]).strip()
        if "code" in data:
            cls["code"] = str(data["code"]).strip()
        if "class_num" in data:
            cls["class_num"] = str(data["class_num"]).strip()
        if "block" in data:
            cls["block"] = str(data["block"]).strip()
        if "room" in data:
            cls["room"] = str(data["room"]).strip()
        if "start_time" in data:
            cls["start_time"] = str(data["start_time"]).strip()
        if "end_time" in data:
            cls["end_time"] = str(data["end_time"]).strip()
        if "days" in data:
            days = data["days"]
            if isinstance(days, str):
                days = [d.strip() for d in days.split(",") if d.strip()]
            cls["days"] = days
        if "faculty" in data:
            cls["faculty"] = str(data["faculty"]).strip()

        return jsonify(cls), 200

@app.route("/api/classes/<int:class_id>", methods=["DELETE"])
def delete_class(class_id):
    global classes
    with lock:
        cls = next((c for c in classes if c["id"] == class_id), None)
        if not cls:
            return jsonify({"error": "Class not found"}), 404
        classes = [c for c in classes if c["id"] != class_id]
        return jsonify({"message": "Class deleted successfully", "id": class_id}), 200

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
