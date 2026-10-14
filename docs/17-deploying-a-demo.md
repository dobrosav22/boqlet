# 17 Deploying a demo on Vercel

How the dev build is put on Vercel for internal demos, what works there and what does not. This is
a demo deployment of the dev build, not the product's hosting: the platform (10) will run the engine
as a worker behind the Java backend.

## What gets deployed

One Vercel project from this repository, everything on one domain:

| Part | What runs | Configured in |
|---|---|---|
| Web app | `apps/web`, built with Vite into static files | `vercel.json`: install, build, output |
| Engine | The engine's FastAPI app as one Python function (`api/index.py`); every `/api/*` request goes to it | `vercel.json`: `functions`, `rewrites` |
| Python packages | The engine's runtime packages | `requirements.txt` at the repository root (keep in sync with `engine/requirements.txt`) |

The build sets `VITE_DEPLOYED=1` and `VITE_MAX_UPLOAD_MB=4.4`. With them the app shows a demo note
under its name, refuses files above the limit with a clear message, and recovers when the engine has
forgotten a model (below). Locally none of this changes anything.

`api/index.py` points the engine's cache and the Library's save folder to `/tmp` (the only writable
place on Vercel) and passes the path the browser asked for to the engine (the rewrite hands it over
as `__path`).

## Deploying

1. In Vercel: **Add New › Project**, import this GitHub repository. Keep the root directory at the
   repository root; everything else comes from `vercel.json`. **Deploy**.
   With the CLI instead: `npx vercel` (a preview), then `npx vercel --prod`.
2. Wait for the build: about a minute for the web app, a few more for the Python packages
   (ifcopenshell is large).
3. Open the deployment, drop `fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc`, **Generate BoQ**. The first
   request after a quiet spell starts the engine and parses the model: allow 20 to 40 seconds. Later
   requests take a second or two.

**Keep it internal.** Under **Settings › Deployment Protection**, Vercel Authentication on its standard
setting asks for a Vercel login on preview deployments, but leaves the production domain public.
Share preview links, or protect all deployments (a paid-plan option). Vercel's Hobby plan is for
personal, non-commercial use; a company demo belongs on a Pro team.

**Region.** Functions run in Washington, D.C. (`iad1`) unless the project's function region is set
closer to the people using the demo (**Settings › Functions**).

## What the demo cannot do

| Limit | Why | What the app does |
|---|---|---|
| IFC files up to 4.4 MB (code lists too) | Vercel refuses request bodies over 4.5 MB | Says so before uploading; run the app locally for larger models |
| The engine forgets models and runs | A function keeps files in `/tmp` of one instance; an instance stops after a few minutes without traffic, and a busy app can use several | Sends the file again and repeats the request when the engine answers "model not found"; generates again when an Excel file is gone. The first request after a pause is slower |
| Library saves are temporary | They are written to `/tmp` | The demo note says so; download a rule set, dictionary or classification (Download JSON) to keep it |
| Answers to questions are lost on reload | As locally: they live in the page | — |
| Uniclass is not offered | Its code list is downloaded locally (`npm run import:uniclass`) and never committed | Shown as not available |
| Five minutes per request | Vercel's maximum duration (Hobby and Pro default) | A model that takes longer to parse fails with a timeout |

Measured on the Duplex (2.4 MB): parse about 15 s, a run about 1.3 s, a run's response 350 KB, the 3D
geometry 475 KB: well inside Vercel's limits (4.5 MB per response).

## When something goes wrong

- **Build fails installing Python packages**: check the build log for the package; `requirements.txt`
  must list only runtime packages (no `pytest`, no `uvicorn`).
- **Every `/api` request is 404**: the rewrite or the function did not deploy. Open
  `/api/health`; it should answer `{"ok": true, ...}`. The function's logs are under the deployment's
  **Functions** tab.
- **"The engine took too long or stopped"**: a cold start with a large model can approach the
  five-minute limit; try again (the parse is cached on that instance) or use a smaller model.
- **A model keeps being "not found"**: the browser re-sends a model only once per request; reload
  the page and drop the file again.

## Changing it

- Engine code and presets deploy as they are; nothing is copied. If the engine gets a new runtime
  package, add it to both `engine/requirements.txt` and the root `requirements.txt`.
- The upload limit shown in the app is `VITE_MAX_UPLOAD_MB` in `vercel.json` (`buildCommand`).
- Files the function does not need are left out with `excludeFiles` in `vercel.json` (tests,
  fixtures, docs, the web sources, `node_modules`). A new folder the engine reads at runtime must not
  be excluded there.
- To test the deployed setup locally: build with the two `VITE_` variables, serve the engine with
  `engine/.venv/Scripts/python -m uvicorn api.index:app --port 8787` (with `IFC_BOQ_CACHE` and
  `IFC_BOQ_USER_PRESETS` pointing to a temporary folder), and `npx vite preview` the web app, which
  proxies `/api` to port 8787.
