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
        UserAccount(name: "Mahe",
                    passcodeHash: "368c0eafc2fbd8da7ea98c0d0429b1e3292c4ef7914eeb6e47a11fa1c26b184d"),
        UserAccount(name: "Rahul",
                    passcodeHash: "45878fb4be730f671a50907dcdc8c4f78a5ea05cc4b586d98200e55c274c6f84"),
        UserAccount(name: "Meera",
                    passcodeHash: "9367fb73c9f1d87053a4e03c77c288b804df94197be67706401a2751aa4bc496"),
        UserAccount(name: "Pooja",
                    passcodeHash: "130400b0812eda744d8376680827ebb819dbe1103fd9241dd5bb9140f7c1c57d"),
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
