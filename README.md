# Absite

iPhone app by Vibgen · **https://absite.vibgen.com**

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
  Core/         config, routing (universal links)
  Features/     one folder per feature (Home, Settings, …)
  Resources/    assets
AbsiteTests/    unit tests
web/            absite.vibgen.com (landing, privacy, support, AASA)
docs/           roadmap and setup checklist
```

## Domain: absite.vibgen.com

1. In your DNS for `vibgen.com`, add: `CNAME absite → rvar839.github.io`
2. Repo → Settings → Pages → Source: **GitHub Actions**; custom domain `absite.vibgen.com`; tick *Enforce HTTPS*.
3. Replace `TEAMID` in `web/.well-known/apple-app-site-association` with your Team ID so universal links work.

## CI

- `ios.yml`: generates the project, builds and runs tests on an iPhone simulator.
- `pages.yml`: deploys `web/` when it changes.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for next steps.
