# Absite: notes for Claude sessions

## Commits

Author every commit as the repo owner so it counts on his GitHub contribution graph.
Before the first commit in a session, run:

```sh
git config user.name "Rahul Varman"
git config user.email "273508223+rvar839@users.noreply.github.com"
```

Commit real work only, straight to `main` (contributions count only on the default branch).
Do not create empty or filler commits to pad the graph.

## Project

- `web/` is the live web app at https://absite.vibgen.com (GitHub Pages deploys it on push).
  Bump the `?v=` number in `web/index.html` whenever `app.js`, `core.js` or `app.css` change.
- `Absite/` is the SwiftUI iPhone app, generated with XcodeGen from `project.yml`.
  It cannot be built in a Linux session; the `iOS` GitHub Action builds and tests it.
- Content lives in `tools/questions.py` and `tools/cards.py`. After editing, run
  `python3 tools/build_content.py` to regenerate the JSON for both apps.
- Scoring, scheduling and analytics exist twice and must stay in step:
  `web/core.js` and `Absite/Core/*.swift`.
- Never put a plain-text passcode in the repo. Users are stored as SHA-256 of `absite.v1:` + passcode.
