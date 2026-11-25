# Learn2Slither (web)

A Q-learning agent that learns to play Snake, in the browser. Everything runs
client-side (training happens in Web Workers), so the site is fully static.

## Development

```bash
npm install
npm run dev
```

## Static build

```bash
npm run build
```

This writes a self-contained static site to `out/`. Upload its contents to any static
host (GitHub Pages, Netlify, S3, nginx, …). No Node.js server is needed.

If the site is served from a sub-path (e.g. `https://user.github.io/learn2slither/`),
set `BASE_PATH` when building:

```bash
BASE_PATH=/learn2slither npm run build              # bash
$env:BASE_PATH = '/learn2slither'; npm run build     # PowerShell
```

To preview the build locally, serve `out/` with any static file server, e.g.
`npx serve out`.

## Deploying to GitHub Pages

`.github/workflows/deploy-pages.yml` builds the site and publishes it on every push to
`master` (or by hand from the Actions tab). The base path is set automatically, so the
site works at `https://<user>.github.io/<repo>/` or on a custom domain.

One-time setup: in the repository, go to Settings → Pages and set
**Build and deployment → Source** to **GitHub Actions**.

## Languages

The site is in English at `/` and in French at `/fr/`, with a link in the header to switch.
The texts live in `app/i18n/messages.tsx` (UI) and `lib/i18n/core.ts` (training log lines
and file errors).
