import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse

from .catalog import Catalog
from .config import Settings, get_settings
from .images import InvalidImage, sanitize_photo
from .llm import ModelClient
from .pipeline import Pipeline, RetryNotAllowed
from .requirements_parser import parse_requirements
from .schemas import ParsedRequirements, ParseRequest, PhotoOut, RecommendationRequest, RetryRequest
from .storage import Store
from .worker import Worker
from .youcam_client import YouCamClient

# httpx logs full request URLs at INFO, which would include signed image URLs.
logging.getLogger("httpx").setLevel(logging.WARNING)

COOKIE = "pp_session"
MAX_RUNS_PER_SESSION = 10
MAX_PARSES_PER_SESSION = 30
PROVIDER_NOTICE = {
    "providers": ["YouCam (Perfect Corp) creates the try-on",
                  "Google Gemini inspects the preview image (on Gemini's free tier, Google may use it to improve its products)"],
    "retention": ("YouCam documents keeping uploaded and generated files for 30 days. Deleting your session removes "
                  "ProofPick's copies right away, but does not delete copies held by those providers."),
}


def build_app(settings: Settings | None = None, *, youcam: YouCamClient | None = None, model: ModelClient | None = None,
              start_worker: bool = True) -> FastAPI:
    settings = settings or get_settings()
    store = Store(settings.var_dir)
    catalog = Catalog.load(settings.catalog_path, settings.catalog_images_dir)
    youcam = youcam or YouCamClient(settings.youcam_api_key, settings.youcam_base_url)
    model = model or ModelClient(settings.gemini_api_key, settings.model)
    pipeline = Pipeline(store, catalog, youcam, model, settings)
    parse_counts: dict[str, int] = {}

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task = asyncio.create_task(Worker(pipeline).run_forever()) if start_worker else None
        yield
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title="ProofPick", lifespan=lifespan)
    app.state.pipeline = pipeline
    app.state.worker = Worker(pipeline)

    def session(response: Response, pp_session: str | None = Cookie(default=None)) -> str:
        session_id = store.ensure_session(pp_session)
        if session_id != pp_session:
            response.set_cookie(COOKIE, session_id, httponly=True, samesite="lax", secure=settings.cookie_secure, max_age=86400)
        return session_id

    def owned_run(run_id: str, session_id: str = Depends(session)) -> dict:
        run = store.get_run(run_id)
        if run is None or run["session_id"] != session_id:
            raise HTTPException(404, "Run not found.")
        return run

    def image_url(evidence_image: str | None) -> str | None:
        return f"/api/catalog-images/{evidence_image}" if evidence_image else None

    def evidence_view(evidence_id: str) -> dict | None:
        e = catalog.evidence(evidence_id)
        if e is None:
            return None
        return {"id": e.id, "field": e.field, "kind": e.kind, "source": e.source, "quote": e.quote,
                "image_url": image_url(e.image), "collected_at": e.collected_at}

    def check_view(check: dict) -> dict:
        return {**check, "evidence": [v for i in check["evidence_ids"] if (v := evidence_view(i))]}

    def job_view(job: dict) -> dict:
        return {
            "id": job["id"], "attempt": job["attempt"], "status": job["status"], "error": job["error"],
            "inspection": job["inspection"],
            "image_url": f"/api/runs/{job['run_id']}/previews/{job['id']}/image" if job["output_path"] else None,
        }

    def product_card(product_id: str, data: dict, jobs: list[dict], explanation: str | None = None) -> dict:
        product = catalog.get(product_id)
        result = data["results"][product_id]
        return {
            "product_id": product.id, "name": product.name, "brand": product.brand, "variant": product.variant,
            "color": product.color, "price": product.price, "currency": product.currency, "description": product.description,
            "image_url": image_url(product.image), "data_label": product.data_label, "collected_at": product.collected_at,
            "status": result["status"], "checks": [check_view(c) for c in result["checks"]], "explanation": explanation,
            "previews": [job_view(j) for j in jobs if j["product_id"] == product_id],
        }

    @app.get("/api/config")
    def config():
        return {
            "youcam_configured": youcam.configured, "model_configured": model.configured,
            "sample_photo_available": settings.sample_photo_path.exists(), "catalog_size": len(catalog.products),
            "privacy": PROVIDER_NOTICE,
        }

    @app.post("/api/requirements/parse", response_model=ParsedRequirements)
    async def parse(body: ParseRequest, session_id: str = Depends(session)):
        parse_counts[session_id] = parse_counts.get(session_id, 0) + 1
        if parse_counts[session_id] > MAX_PARSES_PER_SESSION:
            raise HTTPException(429, "This session has reached its request limit.")
        return await parse_requirements(body.text, model)

    @app.post("/api/photos", response_model=PhotoOut)
    async def upload_photo(file: UploadFile | None = File(default=None), use_sample: bool = Form(default=False),
                           consent: bool = Form(default=False), adult: bool = Form(default=False),
                           session_id: str = Depends(session)):
        if use_sample:
            if not settings.sample_photo_path.exists():
                raise HTTPException(404, "No sample photo is available on this server.")
            raw = settings.sample_photo_path.read_bytes()
        else:
            if not (consent and adult):
                raise HTTPException(400, "Please confirm that this is an adult's photo and that you have consent to use it.")
            if file is None:
                raise HTTPException(400, "Please choose a photo.")
            raw = await file.read(10 * 1024 * 1024 + 1)
        try:
            data, width, height = sanitize_photo(raw)
        except InvalidImage as exc:
            raise HTTPException(400, str(exc)) from exc
        photo_id = store.add_photo(session_id, data, width, height, is_sample=use_sample)
        return PhotoOut(photo_id=photo_id, width=width, height=height, is_sample=use_sample)

    @app.get("/api/photos/{photo_id}/image")
    def photo_image(photo_id: str, session_id: str = Depends(session)):
        photo = store.get_photo(photo_id)
        if photo is None or photo["session_id"] != session_id:
            raise HTTPException(404, "Photo not found.")
        return FileResponse(photo["path"], media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})

    @app.post("/api/recommendations", status_code=202)
    def start_recommendations(body: RecommendationRequest, session_id: str = Depends(session)):
        if store.count_runs(session_id) >= MAX_RUNS_PER_SESSION:
            raise HTTPException(429, "This session has reached its search limit.")
        if body.photo_id:
            photo = store.get_photo(body.photo_id)
            if photo is None or photo["session_id"] != session_id:
                raise HTTPException(400, "That photo is not available.")
        run_id = store.create_run(session_id, body.original_text, body.requirements.model_dump(mode="json"), body.photo_id)
        return {"run_id": run_id}

    @app.get("/api/runs/{run_id}")
    def get_run(run: dict = Depends(owned_run)):
        data, jobs = run["data"], store.jobs_for_run(run["id"])
        report = {"run_id": run["id"], "state": run["state"], "error": run["error"], "requirements": run["requirements"],
                  "original_text": run["original_text"], "has_photo": bool(run["photo_id"])}
        if "ranking" not in data:
            return report
        explanations = {i["product_id"]: i["explanation"] for i in data["ranking"]["items"]}
        shortlist = data["shortlist"]
        results = data["results"]
        retries_left = max(0, settings.max_retries_per_session - store.retries_used(run["session_id"]))
        return {
            **report,
            "ranking_method": data["ranking"]["method"],
            "recommendations": [product_card(p, data, jobs, explanations.get(p)) for p in shortlist],
            "needs_information": [product_card(p, data, []) for p, r in results.items() if r["status"] == "insufficient_evidence"],
            "excluded": [product_card(p, data, []) for p, r in results.items() if r["status"] == "conflicts_with_requirement"],
            "other_eligible": [product_card(p, data, [], explanations.get(p)) for p in explanations if p not in shortlist],
            "no_match": data.get("no_match"),
            "preview_notice": data.get("preview_notice"),
            "retries_remaining": retries_left,
        }

    @app.get("/api/runs/{run_id}/previews/{job_id}/image")
    def preview_image(job_id: str, run: dict = Depends(owned_run)):
        job = store.get_job(job_id)
        if job is None or job["run_id"] != run["id"] or not job["output_path"]:
            raise HTTPException(404, "Preview not found.")
        return FileResponse(job["output_path"], media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})

    @app.post("/api/runs/{run_id}/retry-preview", status_code=202)
    def retry_preview(body: RetryRequest, run: dict = Depends(owned_run)):
        try:
            return {"job_id": pipeline.retry_preview(run, body.product_id)}
        except RetryNotAllowed as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.get("/api/catalog-images/{name}")
    def catalog_image(name: str):
        if not any(p.image == name for p in catalog.products):
            raise HTTPException(404, "Image not found.")
        return FileResponse(Path(settings.catalog_images_dir) / name)

    @app.delete("/api/sessions/{session_id}")
    def delete_session(session_id: str, response: Response, current: str = Depends(session)):
        if session_id != current:
            raise HTTPException(404, "Session not found.")
        store.delete_session(session_id)
        response.delete_cookie(COOKIE)
        return {"deleted": True, "note": PROVIDER_NOTICE["retention"]}

    @app.get("/api/session")
    def get_session(session_id: str = Depends(session)):
        return {"session_id": session_id}

    return app


app = build_app()
