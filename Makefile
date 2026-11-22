.PHONY: bootstrap project open test web

bootstrap:
	brew list xcodegen >/dev/null 2>&1 || brew install xcodegen
	$(MAKE) project

project:
	xcodegen generate

open: project
	open Absite.xcodeproj

test: project
	xcodebuild test -project Absite.xcodeproj -scheme Absite \
	  -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO

web:
	cd web && python3 -m http.server 8080
