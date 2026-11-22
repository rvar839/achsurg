import XCTest
@testable import Absite

final class RouterTests: XCTestCase {
    func testSettingsLinkOpensSettingsTab() {
        let router = Router()
        router.handle(URL(string: "https://absite.vibgen.com/settings")!)
        XCTAssertEqual(router.tab, .settings)
    }

    func testForeignDomainIsIgnored() {
        let router = Router()
        router.tab = .settings
        router.handle(URL(string: "https://example.com/")!)
        XCTAssertEqual(router.tab, .settings)
    }

    func testRootLinkOpensHome() {
        let router = Router()
        router.tab = .settings
        router.handle(URL(string: "https://absite.vibgen.com/")!)
        XCTAssertEqual(router.tab, .home)
    }
}
