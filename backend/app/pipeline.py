"""Controls run transitions. Each step is persisted, so a restart resumes rather than repeats it.

Product verification and preview inspection stay separate: nothing in the
preview path can change a product's eligibility.
"""

import logging
import mimetypes
import time
from datetime import datetime, timezone
from pathlib import Path

from .catalog import Catalog
from .config import Settings
from .llm import ModelClient
from .preview_inspector import assess_attribute, inspect_preview
from .product_verifier import combine, verify_product
from .recommender import rank_candidates
from .schemas import Check, PreviewStatus, ProductResult, ProductStatus, Requirements
from .storage import ACTIVE_JOB_STATUSES, Store, now
from .youcam_client import YouCamClient, YouCamError

log = logging.getLogger("proofpick.pipeline")
MAX_SHORTLIST = 3
MAX_VISUAL_CHECKS = 4
VISUAL_FIELDS = ("sleeves", "neckline")


class RetryNotAllowed(Exception):
    pass


def explain_no_match(results: dict[str, ProductResult]) -> dict:
    """Reports what blocks the request and what relaxing each part would unlock. It relaxes nothing itself."""
    blockers: dict[str, dict[str, int]] = {}
    unlocks: dict[str, int] = {}
    for result in results.values():
        failing = [c for c in result.checks if c.status != ProductStatus.MEETS]
        for check in failing:
            entry = blockers.setdefault(check.requirement, {"conflicts": 0, "unknown": 0})
            entry["conflicts" if check.status == ProductStatus.CONFLICT else "unknown"] += 1
        if len(failing) == 1:
            unlocks[failing[0].requirement] = unlocks.get(failing[0].requirement, 0) + 1
    return {
        "message": "No product in the catalog has documented support for every requirement. Nothing was relaxed.",
        "blockers": [{"requirement": k, **v, "would_unlock": unlocks.get(k, 0)} for k, v in blockers.items()],
    }


class Pipeline:
    def __init__(self, store: Store, catalog: Catalog, youcam: YouCamClient, model: ModelClient, settings: Settings):
        self.store = store
        self.catalog = catalog
        self.youcam = youcam
        self.model = model
        self.settings = settings

    async def advance(self, run_id: str) -> None:
        """Performs one step for a run."""
        run = self.store.get_run(run_id)
        if run is None:
            return
        try:
            if run["state"] in ("queued", "checking"):
                await self._check_products(run)
            elif run["state"] == "ranking":
                await self._rank(run)
            elif run["state"] == "previewing":
                await self._advance_previews(run)
        except Exception:
            # Logged by type only; request data and image URLs stay out of the logs.
            log.exception("Run step failed")
            self.store.update_run(run_id, state="failed", error="Something went wrong while processing this request.")

    async def _check_products(self, run: dict) -> None:
        self.store.update_run(run["id"], state="checking")
        req = Requirements.model_validate(run["requirements"])
        results = {p.id: verify_product(p, req) for p in self.catalog.products}
        await self._fill_gaps_from_photos(results, req)
        data = {"results": {k: v.model_dump(mode="json") for k, v in results.items()}}
        self.store.update_run(run["id"], state="ranking", data=data)

    async def _fill_gaps_from_photos(self, results: dict[str, ProductResult], req: Requirements) -> None:
        """Looks at the original photo only when a text gap in sleeves or neckline is all that blocks a product."""
        if not self.model.configured:
            return
        wanted = {"sleeves": req.sleeves, "neckline": req.neckline}
        used = 0
        for result in results.values():
            if result.status != ProductStatus.INSUFFICIENT:
                continue
            failing = [c for c in result.checks if c.status != ProductStatus.MEETS]
            if not all(c.requirement in VISUAL_FIELDS and not c.evidence_ids for c in failing):
                continue
            product = self.catalog.get(result.product_id)
            replaced: list[Check] = []
            for check in result.checks:
                if check in failing and used < MAX_VISUAL_CHECKS:
                    used += 1
                    visual = await assess_attribute(product, check.requirement, wanted[check.requirement],
                                                    self.catalog.image_path(product), self.model)
                    replaced.append(visual or check)
                else:
                    replaced.append(check)
            result.checks = replaced
            result.status = combine(replaced)

    async def _rank(self, run: dict) -> None:
        req = Requirements.model_validate(run["requirements"])
        results = {k: ProductResult.model_validate(v) for k, v in run["data"]["results"].items()}
        eligible = [self.catalog.get(k) for k, v in results.items() if v.status == ProductStatus.MEETS]
        ranking = await rank_candidates(eligible, results, req, self.catalog, self.model)
        shortlist = [i.product_id for i in ranking.items][:MAX_SHORTLIST]
        data = {**run["data"], "ranking": ranking.model_dump(mode="json"), "shortlist": shortlist}
        if not eligible:
            data["no_match"] = explain_no_match(results)
        if run["photo_id"]:
            data["preview_notice"] = self._create_first_jobs(run, shortlist)
            next_state = "previewing"
        else:
            data["preview_notice"] = "No photo was provided, so no try-on previews were generated."
            next_state = "complete"
        self.store.update_run(run["id"], state=next_state if shortlist else "complete", data=data)

    def _create_first_jobs(self, run: dict, shortlist: list[str]) -> str | None:
        remaining = self.settings.max_previews_per_session - self.store.previews_used(run["session_id"])
        notice = None
        for product_id in shortlist:
            if remaining > 0:
                self.store.create_job(run["id"], run["session_id"], product_id, 1)
                remaining -= 1
            else:
                notice = f"This session's limit of {self.settings.max_previews_per_session} previews has been reached."
                self.store.create_job(run["id"], run["session_id"], product_id, 1, status="skipped", error=notice)
        return notice

    async def _advance_previews(self, run: dict) -> None:
        jobs = self.store.jobs_for_run(run["id"])
        for job in jobs:
            if job["status"] == "pending":
                await self._submit(run, job)
            elif job["status"] == "running" and job["next_poll_at"] <= time.time():
                await self._poll(run, job)
            elif job["status"] == "inspecting":
                await self._inspect(run, job)
        jobs = self.store.jobs_for_run(run["id"])
        if not any(j["status"] in ACTIVE_JOB_STATUSES for j in jobs):
            self.store.update_run(run["id"], state="complete")

    async def _ensure_person_file(self, photo: dict) -> str:
        """The file ID is persisted, so a resumed job never uploads the photo twice."""
        if photo["youcam_file_id"]:
            return photo["youcam_file_id"]
        file_id = await self.youcam.upload_image(Path(photo["path"]).read_bytes(), "person.jpg", "image/jpg")
        self.store.set_photo_file_id(photo["id"], file_id)
        return file_id

    async def _submit(self, run: dict, job: dict) -> None:
        if not self.youcam.configured:
            self.store.update_job(job["id"], status="failed", error="Try-on is unavailable because YouCam is not configured on this server.")
            return
        if self.store.tasks_submitted_today() >= self.settings.max_tasks_per_day:
            self.store.update_job(job["id"], status="failed", error="Today's try-on budget for this demo has been used.")
            return
        photo = self.store.get_photo(run["photo_id"])
        product = self.catalog.get(job["product_id"])
        if photo is None or product is None:
            self.store.update_job(job["id"], status="failed", error="The photo or product is no longer available.")
            return
        try:
            src = await self._ensure_person_file(photo)
            ref = job["garment_file_id"]
            if not ref:
                path = self.catalog.image_path(product)
                content_type = mimetypes.guess_type(path.name)[0] or "image/png"
                ref = await self.youcam.upload_image(path.read_bytes(), path.name, content_type.replace("jpeg", "jpg"))
                self.store.update_job(job["id"], garment_file_id=ref)
            task_id = await self.youcam.create_task(src, ref)
        except YouCamError as exc:
            # A failed create may still have started a task, so it is not repeated automatically.
            self.store.update_job(job["id"], status="failed", error=str(exc))
            return
        self.store.update_job(job["id"], status="running", youcam_task_id=task_id, submitted_at=now(),
                              next_poll_at=time.time() + self.settings.poll_interval_seconds)

    async def _poll(self, run: dict, job: dict) -> None:
        next_poll = time.time() + self.settings.poll_interval_seconds
        try:
            result = await self.youcam.get_task(job["youcam_task_id"])
        except YouCamError as exc:
            if exc.retryable and not self._timed_out(job):
                self.store.update_job(job["id"], next_poll_at=next_poll)
            else:
                self.store.update_job(job["id"], status="failed", error=str(exc))
            return
        if result.status == "running":
            if self._timed_out(job):
                self.store.update_job(job["id"], status="failed", error="YouCam did not finish this preview in time.")
            else:
                self.store.update_job(job["id"], next_poll_at=next_poll)
            return
        if result.status == "error":
            self.store.update_job(job["id"], status="failed", error=f"YouCam could not create this preview: {result.error}")
            return
        try:
            image = await self.youcam.download(result.url)
        except YouCamError as exc:
            self.store.update_job(job["id"], status="failed", error=str(exc))
            return
        if not self.store.session_exists(run["session_id"]):
            return  # deleted while this was in flight
        output = self.store.session_dir(run["session_id"]) / f"preview_{job['id']}.jpg"
        output.write_bytes(image)
        self.store.update_job(job["id"], status="inspecting", output_path=str(output))
        await self._inspect(run, {**job, "output_path": str(output)})

    async def _inspect(self, run: dict, job: dict) -> None:
        product = self.catalog.get(job["product_id"])
        inspection = await inspect_preview(self.catalog.image_path(product), Path(job["output_path"]), self.model)
        self.store.update_job(job["id"], status="done", inspection=inspection.model_dump(mode="json"))

    def _timed_out(self, job: dict) -> bool:
        started = job["submitted_at"] or job["created_at"]
        return _age_seconds(started) > self.settings.task_timeout_seconds

    def retry_preview(self, run: dict, product_id: str) -> str:
        """Allows one retry per session, for a preview that failed or looks questionable."""
        if self.store.retries_used(run["session_id"]) >= self.settings.max_retries_per_session:
            raise RetryNotAllowed("This session's retry has already been used.")
        attempts = [j for j in self.store.jobs_for_run(run["id"]) if j["product_id"] == product_id]
        if not attempts:
            raise RetryNotAllowed("That product has no preview in this run.")
        latest = attempts[-1]
        if latest["status"] in ACTIVE_JOB_STATUSES:
            raise RetryNotAllowed("That preview is still being created.")
        if latest["status"] == "skipped":
            raise RetryNotAllowed("That preview was not attempted because of the session limit.")
        if latest["status"] == "done" and (latest["inspection"] or {}).get("status") == PreviewStatus.NO_MISMATCH.value:
            raise RetryNotAllowed("No visible mismatch was detected, so no retry is needed.")
        job_id = self.store.create_job(run["id"], run["session_id"], product_id, latest["attempt"] + 1)
        self.store.update_run(run["id"], state="previewing")
        return job_id


def _age_seconds(stamp: str) -> float:
    return (datetime.now(timezone.utc) - datetime.fromisoformat(stamp)).total_seconds()
