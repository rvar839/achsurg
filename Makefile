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
	  -destination "platform=iOS Simulator,id=$$(xcrun simctl list devices available | grep -m1 -E '^ +iPhone' | grep -oE '[0-9A-F]{8}-[0-9A-F-]{27}')" CODE_SIGNING_ALLOWED=NO

web:
	cd web && python3 -m http.server 8080
