import CryptoKit
import Foundation
import Observation

struct UserAccount: Identifiable, Equatable {
    let name: String
    /// SHA-256 of "absite.v1:" + passcode. The passcode itself is not stored in the app.
    let passcodeHash: String
    var id: String { name }
}

/// Simple on-device gate. This keeps casual users out; it is not strong security.
/// Move to a real account system (Sign in with Apple or a backend) before a public launch.
enum Auth {
    static let users: [UserAccount] = [
        UserAccount(name: "Achi",
                    passcodeHash: "c7349cb0d25b2d0c27f7f896c67b605fc51e207205db15c50cca2818448354d0"),
    ]

    static func hash(_ passcode: String) -> String {
        SHA256.hash(data: Data(("absite.v1:" + passcode).utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    static func verify(_ user: UserAccount, passcode: String) -> Bool {
        hash(passcode) == user.passcodeHash
    }
}

@Observable
final class Session {
    private static let key = "absite.currentUser"
    private(set) var currentUser: String?

    init() {
        let saved = UserDefaults.standard.string(forKey: Self.key)
        currentUser = Auth.users.contains { $0.name == saved } ? saved : nil
    }

    func login(_ user: UserAccount) {
        currentUser = user.name
        UserDefaults.standard.set(user.name, forKey: Self.key)
    }

    func logout() {
        currentUser = nil
        UserDefaults.standard.removeObject(forKey: Self.key)
    }
}
