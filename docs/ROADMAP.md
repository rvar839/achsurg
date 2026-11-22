# Absite roadmap

## 0. Define the product (open)
- [ ] One-sentence pitch: what Absite does and who it's for
- [ ] The first core feature (replaces the placeholder in `HomeView`)
- [ ] Does it need accounts / a backend? (`AppConfig.apiBaseURL` is reserved as `api.absite.vibgen.com`)
- [ ] App icon (1024×1024 into `Assets.xcassets/AppIcon.appiconset`)

## 1. Accounts & setup
- [ ] Apple Developer Program membership; note Team ID
- [ ] Register App ID `com.vibgen.absite` with Associated Domains capability
- [ ] Create the app record in App Store Connect
- [ ] DNS CNAME `absite` → `rvar839.github.io`; enable GitHub Pages
- [ ] Fill `DEVELOPMENT_TEAM` and AASA `TEAMID`

## 2. MVP
- [ ] Build first feature
- [ ] Persistence (SwiftData) if needed
- [ ] Onboarding screen

## 3. Ship
- [ ] Real privacy policy + support page
- [ ] TestFlight (consider fastlane or Xcode Cloud)
- [ ] App Store screenshots & listing
- [ ] Add `apple-itunes-app` smart banner to the website
