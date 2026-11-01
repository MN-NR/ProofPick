# ProofPick

**Find it. Check it. Try it on.**

ProofPick recommends tops for shoppers with specific requirements. It checks each requirement against product evidence, creates try-on previews with the YouCam Clothes VTO API, and inspects whether those previews preserve the garment's visible details. When information is missing or a preview may mislead, it says so.

> **Demo data:** every product in `backend/data/catalog.json` is fictional, with illustrated garment images, and is labeled as demo data in the interface. No price or stock value is live shopping information.

## How it works

1. **Describe:** the request becomes editable requirements, split into non-negotiable fields and preferences. Nothing is searched until the shopper confirms.
2. **Check products:** backend rules compare each requirement with the evidence and return `meets_documented_requirements`, `conflicts_with_requirement` or `insufficient_evidence`.
3. **Rank:** the model orders eligible products by preference. It cannot change eligibility, and any invented product or evidence ID is rejected.
4. **Try on:** up to three shortlisted products go to YouCam with the shopper's photo.
5. **Inspect:** the model compares each original garment with its preview, feature by feature. The result is `no_visible_mismatch_detected`, `possible_mismatch` or `not_assessable`.
6. **Compare:** each card shows the price, the checks, their source evidence, the preview, and any uncertainty. The shopper decides; ProofPick never buys anything.

Product verification and preview inspection are separate systems, so a bad preview can never make a suitable product look unsuitable.

### What ProofPick does not claim

It does not verify physical fit, comfort, opacity under real lighting, or exact color. Style fit is a judgment, not a verified fact. It never scores a person's body or attractiveness.

## YouCam integration

All authenticated calls run on the server, in `backend/app/youcam_client.py`:

| Step | Call |
|---|---|
| Request upload slots and file IDs | `POST /s2s/v2.0/file` |
| Upload the person and garment images | `PUT` to the returned URL |
| Create the task with `garment_category: upper_body` | `POST /s2s/v2.0/task/cloth-v4` |
| Poll about every 10 seconds | `GET /s2s/v2.0/task/cloth-v4/{task_id}` |
| Save the result, whose URL lasts two hours | `GET` the returned URL |

Task and file IDs are saved in SQLite, so a restart resumes an existing task instead of creating a duplicate. Each session gets three previews and one retry, and `PROOFPICK_MAX_TASKS_PER_DAY` caps the whole deployment.

## Run it locally

You need Python 3.11+ and Node 20+.

```bash
cp .env.example .env      # add YOUCAM_API_KEY and GEMINI_API_KEY

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000

# in a second terminal
cd frontend
npm install
npm run dev               # http://localhost:3000
```

Without keys the app still runs and says what is unavailable:

| Missing | Behavior |
|---|---|
| `YOUCAM_API_KEY` | Previews show as unavailable. No image is faked. |
| `GEMINI_API_KEY` | Parsing and ranking use labeled basic rules. Previews show "Could not be checked". |

The model is Google Gemini, `gemini-3.6-flash` by default (set `PROOFPICK_MODEL` to change it). Get a key at Google AI Studio. On Gemini's free tier, Google may use submitted content, including preview images, to improve its products; use a paid key if that is not acceptable.

To offer the sample model button, add a photo of a consenting adult at `backend/data/sample/model.jpg`.

Create one real preview from the command line (this uses API units):

```bash
cd backend
.venv/bin/python -m scripts.youcam_smoke person.jpg data/catalog_images/top_001.png out.jpg
```

## Tests and evaluation

```bash
cd backend
.venv/bin/python -m pytest          # YouCam and the model are mocked
.venv/bin/python -m eval.run_eval   # writes eval/results.md
```

The evaluation compares the verifier and an ordinary catalog filter on 12 hand-labeled requests. See [the latest results](backend/eval/results.md). The labels were written by the same people as the rules, against a fictional catalog, so this shows the logic behaves as specified. It does not measure real-world accuracy.

## Use real products

Replace `backend/data/catalog.json` and `backend/data/catalog_images/` with products you have permission to use, keeping each item's source and collection date. YouCam asks for a front-facing, single-garment JPEG or PNG of at least 512×384 pixels, under 10 MB. `backend/scripts/build_catalog.py` shows the expected format.

## Deploy

- **Backend:** run one process (`uvicorn app.main:app`), because the worker lives inside it. Mount persistent storage at `PROOFPICK_VAR_DIR` and set `PROOFPICK_COOKIE_SECURE=true`.
- **Frontend:** run `next build` and `next start` with `BACKEND_URL` pointing to the backend. The browser only talks to the frontend, which proxies `/api/*`.

## Privacy

API keys stay on the server. Uploads must be JPEG or PNG and are re-encoded to remove metadata. Photos and previews are stored privately and served only to their session. Signed URLs are kept out of logs.

YouCam documents keeping uploaded and generated files for 30 days. **Delete my data** removes ProofPick's copies right away, but it does not delete copies held by providers.

## Project layout

```
backend/app/       product_verifier, recommender, requirements_parser, preview_inspector,
                   youcam_client, pipeline, worker, storage, main
backend/eval/      labeled cases, baseline comparison and results
backend/scripts/   demo catalog builder and YouCam smoke test
frontend/          Next.js request screen, results screen and evidence panel
```
