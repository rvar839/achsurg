import SwiftUI

struct RootView: View {
    @Environment(Session.self) private var session

    var body: some View {
        if session.currentUser == nil {
            LoginView()
        } else {
            MainTabs()
        }
    }
}

struct MainTabs: View {
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            NavigationStack { QbankView() }
                .tabItem { Label("Qbank", systemImage: "list.bullet.clipboard") }
                .tag(Router.Tab.qbank)

            NavigationStack { FlashcardsView() }
                .tabItem { Label("Flashcards", systemImage: "rectangle.on.rectangle") }
                .tag(Router.Tab.flashcards)

            NavigationStack { AnalyticsView() }
                .tabItem { Label("Analytics", systemImage: "chart.bar") }
                .tag(Router.Tab.analytics)

            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(Router.Tab.settings)
        }
    }
}
