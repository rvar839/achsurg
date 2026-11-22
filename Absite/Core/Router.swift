import Foundation
import Observation

/// App-wide navigation state. Maps incoming universal links to tabs/screens.
@Observable
final class Router {
    enum Tab: Hashable { case home, settings }

    var tab: Tab = .home

    func handle(_ url: URL) {
        guard url.host?.lowercased() == AppConfig.domain else { return }
        switch url.pathComponents.dropFirst().first {
        case "settings": tab = .settings
        default: tab = .home
        }
    }
}
