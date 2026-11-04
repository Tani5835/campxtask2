import json
import pytest
from app import app, tasks, classes, lock

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data == {"status": "healthy"}

def test_index_page(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"CampxTask" in response.data

def test_get_tasks(client):
    response = client.get("/api/tasks")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_create_task(client):
    payload = {
        "title": "Study Dockerfile Syntax",
        "description": "Learn multi-stage builds and container basics.",
        "deadline": "2026-11-15"
    }
    response = client.post("/api/tasks", json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["deadline"] == payload["deadline"]
    assert data["status"] == "pending"
    assert data["completed"] is False
    assert "id" in data

def test_create_task_validation(client):
    response = client.post("/api/tasks", json={"title": "  ", "deadline": "2026-11-15"})
    assert response.status_code == 400
    response = client.post("/api/tasks", data="not json", content_type="text/plain")
    assert response.status_code == 400

def test_update_task_status(client):
    res = client.post("/api/tasks", json={"title": "Task to Update", "deadline": "2026-11-20"})
    task_id = res.get_json()["id"]

    patch_res = client.patch(f"/api/tasks/{task_id}", json={"completed": True})
    assert patch_res.status_code == 200
    updated = patch_res.get_json()
    assert updated["completed"] is True
    assert updated["status"] == "completed"

    patch_res2 = client.patch(f"/api/tasks/{task_id}", json={"completed": False})
    assert patch_res2.status_code == 200
    updated2 = patch_res2.get_json()
    assert updated2["completed"] is False
    assert updated2["status"] == "pending"

def test_delete_task(client):
    res = client.post("/api/tasks", json={"title": "Task to Delete", "deadline": "2026-11-20"})
    task_id = res.get_json()["id"]

    del_res = client.delete(f"/api/tasks/{task_id}")
    assert del_res.status_code == 200
    assert del_res.get_json()["id"] == task_id

    del_res2 = client.delete(f"/api/tasks/{task_id}")
    assert del_res2.status_code == 404

def test_not_found_routes(client):
    res_patch = client.patch("/api/tasks/99999", json={"completed": True})
    assert res_patch.status_code == 404

    res_del = client.delete("/api/tasks/99999")
    assert res_del.status_code == 404

def test_classes_endpoints(client):
    # GET classes
    get_res = client.get("/api/classes")
    assert get_res.status_code == 200
    assert len(get_res.get_json()) >= 1

    # POST class
    cls_payload = {
        "subject": "Mobile Computing",
        "code": "CS405",
        "class_num": "Lab 02",
        "block": "Aryabhata Block",
        "room": "Room 101",
        "start_time": "14:00",
        "end_time": "15:30",
        "days": ["Monday", "Wednesday"],
        "faculty": "Prof. Smith"
    }
    create_res = client.post("/api/classes", json=cls_payload)
    assert create_res.status_code == 201
    cls_data = create_res.get_json()
    assert cls_data["subject"] == "Mobile Computing"
    cls_id = cls_data["id"]

    # PATCH class
    patch_res = client.patch(f"/api/classes/{cls_id}", json={"room": "Room 102"})
    assert patch_res.status_code == 200
    assert patch_res.get_json()["room"] == "Room 102"

    # DELETE class
    del_res = client.delete(f"/api/classes/{cls_id}")
    assert del_res.status_code == 200
    assert del_res.get_json()["id"] == cls_id
