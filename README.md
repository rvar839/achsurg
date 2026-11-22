# Absite

ABSITE study app for iPhone by Vibgen · **https://absite.vibgen.com**

Three connected parts: a **Qbank** (random questions with explanations), **Flashcards** (cloze cards with two-button spaced repetition; missed questions become cards), and **Analytics** (one score with a 70% goal, topic strengths, and a manual review list).

| | |
|---|---|
| Platform | iOS 17+, iPhone only |
| UI | SwiftUI, `@Observable` |
| Bundle ID | `com.vibgen.absite` |
| Project | Generated with [XcodeGen](https://github.com/yonaskolb/XcodeGen) from `project.yml` |
| Website | Static site in `web/`, deployed by GitHub Pages to `absite.vibgen.com` |

## Getting started (Mac)

```sh
git clone https://github.com/rvar839/achsurg.git
cd achsurg
make bootstrap   # installs XcodeGen, generates Absite.xcodeproj
make open        # opens in Xcode
```

Set your Apple Developer Team ID in `project.yml` (`DEVELOPMENT_TEAM`), then run `make project` again.
The `.xcodeproj` is generated and git-ignored, so edit `project.yml` instead of project settings in Xcode.

## Layout

```
Absite/
  App/          entry point + root tab view
  Core/         models, scheduler, analytics, progress storage, login
  Features/     Login, Qbank, Flashcards, Analytics, Settings
  Resources/    assets + Content/ (questions.json, cards.json)
AbsiteTests/    unit tests
tools/          content source (questions.py, cards.py) + build_content.py
web/            absite.vibgen.com (landing, privacy, support, AASA)
docs/           roadmap and setup checklist
```

## Adding content

Edit `tools/questions.py` and `tools/cards.py`, then run `python3 tools/build_content.py`.
It validates the content and regenerates the JSON the app ships with.
All content must be reviewed by a surgeon before release.

## Domain: absite.vibgen.com

1. In your DNS for `vibgen.com`, add: `CNAME absite → rvar839.github.io`
2. Repo → Settings → Pages → Source: **GitHub Actions**; custom domain `absite.vibgen.com`; tick *Enforce HTTPS*.
3. Replace `TEAMID` in `web/.well-known/apple-app-site-association` with your Team ID so universal links work.

## CI

- `ios.yml`: generates the project, builds and runs tests on an iPhone simulator.
- `pages.yml`: deploys `web/` when it changes.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for next steps.
