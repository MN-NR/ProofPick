import asyncio
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.llm import ModelClient
from app.main import build_app
from app.youcam_client import TaskResult, YouCamError

REQ = {"max_price_usd": 60, "sleeves": "long", "neckline": "high", "excluded_materials": ["polyester"], "preferences": ["work-appropriate"]}


class FakeYouCam:
    configured = True

    def __init__(self):
        self.created, self.polls, self.uploads = [], [], 0
        self.result = TaskResult("success", url="https://signed.test/r")
        self.fail_create = False

    async def upload_image(self, data, name, content_type):
        self.uploads += 1
        return f"file{self.uploads}"

    async def create_task(self, src, ref):
        if self.fail_create:
            raise YouCamError("YouCam task creation failed", code="CreditInsufficiency")
        self.created.append((src, ref))
        return f"task{len(self.created)}"

    async def get_task(self, task_id):
        self.polls.append(task_id)
        return self.result

    async def download(self, url):
        return _jpeg()


def _jpeg(size=(800, 600)):
    buf = io.BytesIO()
    Image.new("RGB", size, (120, 120, 120)).save(buf, "JPEG", exif=Image.Exif())
    return buf.getvalue()


@pytest.fixture
def env(tmp_path):
    settings = Settings(_env_file=None, PROOFPICK_VAR_DIR=tmp_path, PROOFPICK_POLL_INTERVAL_SECONDS=0)
    youcam = FakeYouCam()
    app = build_app(settings, youcam=youcam, model=ModelClient("", "m"), start_worker=False)
    return TestClient(app), app, youcam


def drain(app, ticks=12):
    for _ in range(ticks):
        asyncio.run(app.state.worker.tick())


def upload(client):
    response = client.post("/api/photos", data={"consent": "true", "adult": "true"},
                           files={"file": ("me.jpg", _jpeg(), "image/jpeg")})
    assert response.status_code == 200
    return response.json()["photo_id"]


def start(client, photo_id=None, req=REQ):
    response = client.post("/api/recommendations", json={"requirements": req, "photo_id": photo_id})
    assert response.status_code == 202
    return response.json()["run_id"]


def test_full_journey(env):
    client, app, youcam = env
    run_id = start(client, upload(client))
    assert client.get(f"/api/runs/{run_id}").json()["state"] == "queued"
    drain(app)
    report = client.get(f"/api/runs/{run_id}").json()
    assert report["state"] == "complete"
    assert len(report["recommendations"]) == 3 and len(youcam.created) == 3
    assert all(c["status"] == "meets_documented_requirements" for c in report["recommendations"])
    needs = {c["product_id"] for c in report["needs_information"]}
    assert {"top_005", "top_007", "top_008", "top_009", "top_015"} == needs
    assert "top_003" in {c["product_id"] for c in report["excluded"]}
    preview = report["recommendations"][0]["previews"][0]
    assert preview["status"] == "done"
    # With no model available the preview is reported as not inspected, not as passed.
    assert preview["inspection"]["status"] == "not_assessable"
    assert client.get(preview["image_url"]).status_code == 200
    assert "signed.test" not in str(report) and "task1" not in str(report)
    assert report["recommendations"][0]["checks"][0]["evidence"][0]["quote"]


def test_failed_preview_never_changes_product_status(env):
    client, app, youcam = env
    youcam.result = TaskResult("error", error="error_pose")
    run_id = start(client, upload(client))
    drain(app)
    card = client.get(f"/api/runs/{run_id}").json()["recommendations"][0]
    assert card["status"] == "meets_documented_requirements"
    assert card["previews"][0]["status"] == "failed" and "error_pose" in card["previews"][0]["error"]


def test_restart_resumes_existing_task(env, tmp_path):
    client, app, youcam = env
    youcam.result = TaskResult("running")
    run_id = start(client, upload(client))
    drain(app)
    submitted = len(youcam.created)
    assert submitted == 3
    # A new process with the same database polls the same tasks.
    second = FakeYouCam()
    settings = Settings(_env_file=None, PROOFPICK_VAR_DIR=tmp_path, PROOFPICK_POLL_INTERVAL_SECONDS=0)
    app2 = build_app(settings, youcam=second, model=ModelClient("", "m"), start_worker=False)
    drain(app2)
    assert second.created == [] and second.uploads == 0
    assert set(second.polls) == {"task1", "task2", "task3"}


def test_one_retry_per_session(env):
    client, app, youcam = env
    youcam.fail_create = True
    run_id = start(client, upload(client))
    drain(app)
    report = client.get(f"/api/runs/{run_id}").json()
    pid = report["recommendations"][0]["product_id"]
    assert report["retries_remaining"] == 1
    youcam.fail_create = False
    assert client.post(f"/api/runs/{run_id}/retry-preview", json={"product_id": pid}).status_code == 202
    drain(app)
    report = client.get(f"/api/runs/{run_id}").json()
    assert report["retries_remaining"] == 0
    assert [p["status"] for p in report["recommendations"][0]["previews"]] == ["failed", "done"]
    other = report["recommendations"][1]["product_id"]
    assert client.post(f"/api/runs/{run_id}/retry-preview", json={"product_id": other}).status_code == 409


def test_session_preview_limit_is_enforced_across_runs(env):
    client, app, youcam = env
    photo = upload(client)
    start(client, photo)
    drain(app)
    second = start(client, photo)
    drain(app)
    assert len(youcam.created) == 3
    report = client.get(f"/api/runs/{second}").json()
    assert report["state"] == "complete" and "limit" in report["preview_notice"]
    assert all(c["previews"][0]["status"] == "skipped" for c in report["recommendations"])


def test_no_match_explains_without_relaxing(env):
    client, app, youcam = env
    run_id = start(client, upload(client), {**REQ, "max_price_usd": 10})
    drain(app)
    report = client.get(f"/api/runs/{run_id}").json()
    assert report["recommendations"] == [] and report["state"] == "complete"
    assert "Nothing was relaxed" in report["no_match"]["message"]
    budget = next(b for b in report["no_match"]["blockers"] if b["requirement"] == "budget")
    assert budget["would_unlock"] >= 1
    assert youcam.created == []


def test_no_photo_skips_try_on(env):
    client, app, youcam = env
    run_id = start(client)
    drain(app)
    report = client.get(f"/api/runs/{run_id}").json()
    assert report["state"] == "complete" and youcam.created == [] and "No photo" in report["preview_notice"]


def test_photo_rules(env):
    client, _, _ = env
    good = ("me.jpg", _jpeg(), "image/jpeg")
    assert client.post("/api/photos", files={"file": good}).status_code == 400  # no consent
    bad = ("x.jpg", b"not an image", "image/jpeg")
    assert client.post("/api/photos", data={"consent": "true", "adult": "true"}, files={"file": bad}).status_code == 400
    small = ("s.jpg", _jpeg((100, 100)), "image/jpeg")
    assert client.post("/api/photos", data={"consent": "true", "adult": "true"}, files={"file": small}).status_code == 400


def test_other_sessions_cannot_read_runs_and_delete_clears_data(env, tmp_path):
    client, app, _ = env
    run_id = start(client, upload(client))
    drain(app)
    stranger = TestClient(app)
    assert stranger.get(f"/api/runs/{run_id}").status_code == 404
    session_id = client.get("/api/session").json()["session_id"]
    assert stranger.delete(f"/api/sessions/{session_id}").status_code == 404
    deleted = client.delete(f"/api/sessions/{session_id}")
    assert deleted.status_code == 200 and "does not delete" in deleted.json()["note"]
    assert not (tmp_path / "sessions" / session_id).exists()


def test_unconfigured_youcam_fails_honestly(tmp_path):
    settings = Settings(_env_file=None, PROOFPICK_VAR_DIR=tmp_path, YOUCAM_API_KEY="")
    app = build_app(settings, model=ModelClient("", "m"), start_worker=False)
    client = TestClient(app)
    run_id = start(client, upload(client))
    drain(app)
    preview = client.get(f"/api/runs/{run_id}").json()["recommendations"][0]["previews"][0]
    assert preview["status"] == "failed" and preview["image_url"] is None
