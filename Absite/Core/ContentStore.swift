import Foundation

/// Read-only question bank and flashcard deck bundled with the app.
final class ContentStore {
    static let shared = ContentStore()

    let questions: [Question]
    let cards: [Flashcard]
    let questionsByID: [String: Question]
    let topics: [String]

    init(questions: [Question], cards: [Flashcard]) {
        self.questions = questions
        self.cards = cards
        var byID: [String: Question] = [:]
        for question in questions { byID[question.id] = question }
        questionsByID = byID
        topics = Array(Set(questions.map(\.topic) + cards.map(\.topic))).sorted()
    }

    convenience init(bundle: Bundle = .main) {
        self.init(questions: Self.load("questions", from: bundle),
                  cards: Self.load("cards", from: bundle))
    }

    private static func load<T: Decodable>(_ name: String, from bundle: Bundle) -> [T] {
        guard let url = bundle.url(forResource: name, withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let items = try? JSONDecoder().decode([T].self, from: data) else {
            return []
        }
        return items
    }

    /// The flashcard created when a question is answered wrong.
    func missedCard(for question: Question) -> Flashcard {
        Flashcard(id: "missed-\(question.id)", topic: question.topic,
                  text: question.card.text, extra: question.card.extra,
                  fromMissedQuestion: true)
    }

    /// Full deck for a user: cards from missed questions first, then the core deck.
    func deck(for progress: UserProgress) -> [Flashcard] {
        let missed = progress.missedQuestionIDs.compactMap { id -> Flashcard? in
            guard let question = questionsByID[id] else { return nil }
            return missedCard(for: question)
        }
        return missed + cards
    }
}
