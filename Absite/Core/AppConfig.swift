import Foundation

enum AppConfig {
    static let appName = "Absite"
    static let domain = "absite.vibgen.com"
    static let websiteURL = URL(string: "https://\(domain)")!
    static let privacyURL = URL(string: "https://\(domain)/privacy.html")!
    static let supportURL = URL(string: "https://\(domain)/support.html")!
    /// Placeholder for a future backend.
    static let apiBaseURL = URL(string: "https://api.\(domain)")!

    static var version: String {
        let info = Bundle.main.infoDictionary
        let v = info?["CFBundleShortVersionString"] as? String ?? "?"
        let b = info?["CFBundleVersion"] as? String ?? "?"
        return "\(v) (\(b))"
    }
}
