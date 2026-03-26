# ArbuzGram

## Quick Windows Start (auto install)

This repository now includes `setup-run.ps1`. The script will:
- install Node.js LTS with `winget` if Node is missing,
- install npm dependencies,
- create `.env.local` if it does not exist,
- run `npm run dev`.

Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup-run.ps1
```

If you use Gemini bot features, set your key in `.env.local`:

```env
GEMINI_API_KEY=your_key_here
```

## Manual local run

```powershell
npm install
npm run dev
```

## GitHub Pages deploy (without standalone)

The project is configured to deploy the Vite build from `dist` via GitHub Actions.

1. Push code to `main`.
2. Open `Settings -> Pages` in your GitHub repo.
3. In `Build and deployment` select:
   - `Source`: `Deploy from a branch`
   - `Branch`: `gh-pages` and `/ (root)`
4. Wait for the workflow `Deploy to GitHub Pages` to finish.

This publishes the normal Vite app build (not `standalone.html`).
