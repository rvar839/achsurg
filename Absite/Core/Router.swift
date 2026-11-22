import Foundation
import Observation

/// App-wide navigation state. Maps incoming universal links to tabs.
@Observable
final class Router {
    enum Tab: Hashable { case qbank, flashcards, analytics, settings }

    var tab: Tab = .qbank

    func handle(_ url: URL) {
        guard url.host?.lowercased() == AppConfig.domain else { return }
        switch url.pathComponents.dropFirst().first {
        case "flashcards": tab = .flashcards
        case "analytics": tab = .analytics
        case "settings": tab = .settings
        default: tab = .qbank
        }
    }
}
