import SwiftUI

@main
struct AbsiteApp: App {
    @State private var router = Router()
    @State private var session: Session
    @State private var progress: ProgressStore

    init() {
        let session = Session()
        let progress = ProgressStore()
        if let user = session.currentUser {
            progress.load(user: user)
        }
        _session = State(initialValue: session)
        _progress = State(initialValue: progress)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(router)
                .environment(session)
                .environment(progress)
                // Universal links from https://absite.vibgen.com/...
                .onOpenURL { router.handle($0) }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL { router.handle(url) }
                }
        }
    }
}
