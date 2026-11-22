import SwiftUI

@main
struct AbsiteApp: App {
    @State private var router = Router()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(router)
                // Universal links from https://absite.vibgen.com/...
                .onOpenURL { router.handle($0) }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL { router.handle(url) }
                }
        }
    }
}
