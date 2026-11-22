import XCTest
@testable import Absite

final class RouterTests: XCTestCase {
    func testLinksOpenTheRightTab() {
        let router = Router()
        router.handle(URL(string: "https://absite.vibgen.com/analytics")!)
        XCTAssertEqual(router.tab, .analytics)
        router.handle(URL(string: "https://absite.vibgen.com/flashcards")!)
        XCTAssertEqual(router.tab, .flashcards)
        router.handle(URL(string: "https://absite.vibgen.com/")!)
        XCTAssertEqual(router.tab, .qbank)
    }

    func testForeignDomainIsIgnored() {
        let router = Router()
        router.tab = .settings
        router.handle(URL(string: "https://example.com/analytics")!)
        XCTAssertEqual(router.tab, .settings)
    }
}

final class ContentTests: XCTestCase {
    func testBundledContentLoadsAndIsValid() {
        let content = ContentStore.shared
        XCTAssertGreaterThan(content.questions.count, 20)
        XCTAssertGreaterThan(content.cards.count, 100)
        for question in content.questions {
            XCTAssertTrue(question.choices.indices.contains(question.answer), question.id)
            XCTAssertTrue(Cloze.segments(question.card.text).contains { $0.isCloze }, question.id)
        }
        for card in content.cards {
            XCTAssertTrue(Cloze.segments(card.text).contains { $0.isCloze }, card.id)
        }
        let ids = content.questions.map(\.id) + content.cards.map(\.id)
        XCTAssertEqual(ids.count, Set(ids).count)
    }
}

final class ClozeTests: XCTestCase {
    func testSegments() {
        let segments = Cloze.segments("Treat with {{dantrolene}} now.")
        XCTAssertEqual(segments, [
            Cloze.Segment(text: "Treat with ", isCloze: false),
            Cloze.Segment(text: "dantrolene", isCloze: true),
            Cloze.Segment(text: " now.", isCloze: false),
        ])
        XCTAssertEqual(Cloze.plain("{{A}} then {{B}}"), "A then B")
    }
}

final class SchedulerTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testKnowPushesCardOut() {
        let first = Scheduler.review(nil, knew: true, now: now)
        XCTAssertEqual(first.box, 1)
        XCTAssertEqual(first.due.timeIntervalSince(now), 86_400, accuracy: 1)
        let second = Scheduler.review(first, knew: true, now: first.due)
        XCTAssertEqual(second.box, 2)
        XCTAssertEqual(second.due.timeIntervalSince(first.due), 3 * 86_400, accuracy: 1)
    }

    func testDontKnowBringsCardBackSoon() {
        let known = Scheduler.review(Scheduler.review(nil, knew: true, now: now), knew: true, now: now)
        let lapsed = Scheduler.review(known, knew: false, now: now)
        XCTAssertEqual(lapsed.box, 0)
        XCTAssertEqual(lapsed.lapses, 1)
        XCTAssertEqual(lapsed.due.timeIntervalSince(now), Scheduler.relearnDelay, accuracy: 1)
        // After a lapse the next interval is shorter than for a clean card.
        let relearned = Scheduler.review(lapsed, knew: true, now: now)
        XCTAssertLessThan(relearned.due.timeIntervalSince(now), 86_400)
    }
}

final class AuthTests: XCTestCase {
    func testWrongPasscodeIsRejected() {
        let user = Auth.users[0]
        XCTAssertFalse(Auth.verify(user, passcode: ""))
        XCTAssertFalse(Auth.verify(user, passcode: "wrong"))
        XCTAssertEqual(Auth.hash("x"), Auth.hash("x"))
        XCTAssertNotEqual(Auth.hash("x"), Auth.hash("y"))
    }
}

final class AnalyticsTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    private func makeContent() -> ContentStore {
        let card = ClozeCard(text: "Key {{fact}}", extra: "More")
        let questions = (1...4).map { index in
            Question(id: "q\(index)", topic: index <= 2 ? "Trauma" : "Burns", stem: "Stem",
                     choices: ["A", "B"], answer: 0, explanation: "Because", card: card)
        }
        let cards = (1...4).map { index in
            Flashcard(id: "c\(index)", topic: index <= 2 ? "Trauma" : "Burns", text: "A {{b}}", extra: "c")
        }
        return ContentStore(questions: questions, cards: cards)
    }

    func testEmptyProgressScoresZero() {
        let summary = Analytics.summarize(progress: UserProgress(), content: makeContent(), now: now)
        XCTAssertEqual(summary.score, 0)
        XCTAssertFalse(summary.hasData)
    }

    func testScoreBlendsQuestionsAndCards() {
        let content = makeContent()
        var progress = UserProgress()
        // Two of four questions correct -> question score 50%.
        progress.attempts = [
            Attempt(questionID: "q1", topic: "Trauma", correct: true, date: now),
            Attempt(questionID: "q2", topic: "Trauma", correct: true, date: now),
        ]
        // All four cards fully known -> card score 100%.
        for index in 1...4 {
            progress.cardStates["c\(index)"] = CardState(box: 3, due: now.addingTimeInterval(86_400))
        }
        let summary = Analytics.summarize(progress: progress, content: content, now: now)
        XCTAssertEqual(summary.questionScore, 0.5, accuracy: 0.001)
        XCTAssertEqual(summary.cardScore, 1.0, accuracy: 0.001)
        XCTAssertEqual(summary.score, 0.75, accuracy: 0.001)
        XCTAssertEqual(summary.strong.map(\.topic), ["Trauma"])
    }

    func testMissedQuestionAddsCardAndReviewItem() {
        let content = makeContent()
        var progress = UserProgress()
        progress.attempts = [Attempt(questionID: "q3", topic: "Burns", correct: false, date: now)]
        progress.missedQuestionIDs = ["q3"]
        let summary = Analytics.summarize(progress: progress, content: content, now: now)
        XCTAssertEqual(summary.cardsTotal, 5)
        XCTAssertEqual(summary.missed.count, 1)
        XCTAssertEqual(summary.missed.first?.concept, "Key fact")
        XCTAssertEqual(summary.missed.first?.resolved, false)
        XCTAssertTrue(content.deck(for: progress).first?.fromMissedQuestion == true)
    }

    func testStreakCountsConsecutiveDays() {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)
        let days: Set<Date> = [today,
                               calendar.date(byAdding: .day, value: -1, to: today)!,
                               calendar.date(byAdding: .day, value: -3, to: today)!]
        XCTAssertEqual(Analytics.streak(days: days, now: now), 2)
    }
}
