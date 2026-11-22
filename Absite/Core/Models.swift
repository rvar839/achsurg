import Foundation

struct ClozeCard: Codable, Hashable {
    let text: String
    let extra: String
}

struct Question: Codable, Identifiable, Hashable {
    let id: String
    let topic: String
    let stem: String
    let choices: [String]
    let answer: Int
    let explanation: String
    /// The key fact behind this question. Becomes a flashcard if the question is missed.
    let card: ClozeCard
}

struct Flashcard: Codable, Identifiable, Hashable {
    let id: String
    let topic: String
    /// Cloze text; the hidden parts are wrapped in {{double braces}}.
    let text: String
    /// Short definition or guideline shown after the card is revealed.
    let extra: String
    var fromMissedQuestion: Bool = false

    private enum CodingKeys: String, CodingKey {
        case id, topic, text, extra
    }
}

struct Attempt: Codable, Hashable {
    let questionID: String
    let topic: String
    let correct: Bool
    let date: Date
}

struct CardState: Codable, Equatable {
    /// 0 = not yet known. Each "Know" moves the card up one box and lengthens its interval.
    var box: Int = 0
    var due: Date
    var reviews: Int = 0
    var lapses: Int = 0
    var lastReviewed: Date?
}

struct UserProgress: Codable, Equatable {
    var attempts: [Attempt] = []
    var cardStates: [String: CardState] = [:]
    /// Questions answered wrong at least once; each adds its key-fact card to the deck.
    var missedQuestionIDs: [String] = []
    var activeDays: Set<Date> = []

    /// Result of the most recent attempt at each question.
    var lastResults: [String: Bool] {
        var out: [String: Bool] = [:]
        for attempt in attempts { out[attempt.questionID] = attempt.correct }
        return out
    }
}
