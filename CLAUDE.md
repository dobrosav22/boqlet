# CLAUDE.md

The product root is **`boqlet_v1/`** (P44). Read [`boqlet_v1/CLAUDE.md`](boqlet_v1/CLAUDE.md)
first. Every path there and in `boqlet_v1/plan/` is relative to `boqlet_v1/`, and every npm
command runs in `boqlet_v1/`.

The repository root holds only what has to live here, until FE-046 makes `boqlet_v1/` the
repository root:

| Path | What |
|---|---|
| `.github/workflows/` | CI (product jobs run with `working-directory: boqlet_v1`) |
| `.claude/` | Agent settings |
| `vercel.json`, `api/index.py`, `requirements.txt` | The proof-of-concept demo deployment (`boqlet_v1/docs/17-deploying-a-demo.md`), pointed into `boqlet_v1/` |

The build happens on the branch `v_1` (P46); `main` keeps the proof of concept until the release.
