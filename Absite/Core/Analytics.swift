import Foundation

struct TopicStat: Identifiable, Equatable {
    let topic: String
    var questionsTotal = 0
    var questionsSeen = 0
    var questionCredit = 0.0
    var cardsTotal = 0
    var cardsSeen = 0
    var cardCredit = 0.0
    var misses = 0

    var id: String { topic }
    var started: Bool { questionsSeen + cardsSeen > 0 }

    /// 0...1 mastery of everything in this topic. Unseen material counts as not yet known.
    var score: Double {
        Analytics.blend(questionCredit: questionCredit, questionsTotal: questionsTotal,
                        cardCredit: cardCredit, cardsTotal: cardsTotal)
    }
}

struct MissedItem: Identifiable, Equatable {
    let id: String
    let topic: String
    let concept: String
    let misses: Int
    /// True once the most recent attempt at the question was correct.
    let resolved: Bool
}

struct AnalyticsSummary {
    var score = 0.0
    var questionScore = 0.0
    var cardScore = 0.0
    var questionsSeen = 0
    var questionsTotal = 0
    var cardsSeen = 0
    var cardsTotal = 0
    var cardsDue = 0
    var streak = 0
    var topics: [TopicStat] = []
    var missed: [MissedItem] = []
    var insights: [String] = []
    var nextStep = ""

    var hasData: Bool { questionsSeen + cardsSeen > 0 }
    var weak: [TopicStat] { topics.filter { $0.started && $0.score < 0.5 } }
    var strong: [TopicStat] { topics.filter { $0.score >= Theme.goal } }
}

/// Turns raw study history into the single score, topic strengths and review list.
/// The same numbers drive what the Qbank and flashcards serve next.
enum Analytics {
    /// How much a flashcard counts toward the score, by how far it has been pushed out.
    static func cardCredit(_ state: CardState?) -> Double {
        guard let state else { return 0 }
        switch state.box {
        case 0: return 0
        case 1: return 0.4
        case 2: return 0.7
        default: return 1
        }
    }

    static func blend(questionCredit: Double, questionsTotal: Int,
                      cardCredit: Double, cardsTotal: Int) -> Double {
        let q = questionsTotal > 0 ? questionCredit / Double(questionsTotal) : nil
        let c = cardsTotal > 0 ? cardCredit / Double(cardsTotal) : nil
        switch (q, c) {
        case let (q?, c?): return (q + c) / 2
        case let (q?, nil): return q
        case let (nil, c?): return c
        default: return 0
        }
    }

    static func summarize(progress: UserProgress, content: ContentStore, now: Date = Date()) -> AnalyticsSummary {
        var summary = AnalyticsSummary()
        var stats: [String: TopicStat] = [:]
        let last = progress.lastResults

        var missCounts: [String: Int] = [:]
        for attempt in progress.attempts where !attempt.correct {
            missCounts[attempt.questionID, default: 0] += 1
        }

        var questionCredit = 0.0
        for question in content.questions {
            var stat = stats[question.topic] ?? TopicStat(topic: question.topic)
            stat.questionsTotal += 1
            if let result = last[question.id] {
                stat.questionsSeen += 1
                summary.questionsSeen += 1
                if result {
                    stat.questionCredit += 1
                    questionCredit += 1
                }
            }
            stat.misses += missCounts[question.id] ?? 0
            stats[question.topic] = stat
        }

        let deck = content.deck(for: progress)
        var cardCreditTotal = 0.0
        for card in deck {
            var stat = stats[card.topic] ?? TopicStat(topic: card.topic)
            stat.cardsTotal += 1
            if let state = progress.cardStates[card.id] {
                stat.cardsSeen += 1
                summary.cardsSeen += 1
                let credit = cardCredit(state)
                stat.cardCredit += credit
                cardCreditTotal += credit
                if state.due <= now { summary.cardsDue += 1 }
            }
            stats[card.topic] = stat
        }

        summary.questionsTotal = content.questions.count
        summary.cardsTotal = deck.count
        summary.questionScore = summary.questionsTotal > 0 ? questionCredit / Double(summary.questionsTotal) : 0
        summary.cardScore = summary.cardsTotal > 0 ? cardCreditTotal / Double(summary.cardsTotal) : 0
        summary.score = blend(questionCredit: questionCredit, questionsTotal: summary.questionsTotal,
                              cardCredit: cardCreditTotal, cardsTotal: summary.cardsTotal)
        summary.topics = stats.values.sorted {
            if $0.started != $1.started { return $0.started }
            if $0.score != $1.score { return $0.score < $1.score }
            return $0.topic < $1.topic
        }
        summary.streak = streak(days: progress.activeDays, now: now)

        summary.missed = missCounts.compactMap { id, count -> MissedItem? in
            guard let question = content.questionsByID[id] else { return nil }
            return MissedItem(id: id, topic: question.topic, concept: Cloze.plain(question.card.text),
                              misses: count, resolved: last[id] == true)
        }
        .sorted {
            if $0.resolved != $1.resolved { return !$0.resolved }
            if $0.misses != $1.misses { return $0.misses > $1.misses }
            return $0.id < $1.id
        }

        summary.nextStep = nextStep(summary)
        summary.insights = insights(summary, progress: progress)
        return summary
    }

    static func streak(days: Set<Date>, now: Date, calendar: Calendar = .current) -> Int {
        var day = calendar.startOfDay(for: now)
        if !days.contains(day) {
            guard let yesterday = calendar.date(byAdding: .day, value: -1, to: day) else { return 0 }
            day = yesterday
        }
        var count = 0
        while days.contains(day) {
            count += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: day) else { break }
            day = previous
        }
        return count
    }

    private static func nextStep(_ s: AnalyticsSummary) -> String {
        if s.cardsDue > 0 {
            return "\(s.cardsDue) flashcard\(s.cardsDue == 1 ? " is" : "s are") due. Review them first."
        }
        if let weakest = s.weak.first {
            return "Weakest area: \(weakest.topic). Do its questions and cards next."
        }
        if s.questionsSeen < s.questionsTotal {
            return "\(s.questionsTotal - s.questionsSeen) questions not yet attempted. Keep going in the Qbank."
        }
        if s.cardsSeen < s.cardsTotal {
            return "\(s.cardsTotal - s.cardsSeen) flashcards not yet started. Learn a new batch."
        }
        return s.score >= Theme.goal ? "At goal. Keep up the daily reviews." : "Keep reviewing due cards to lift the score."
    }

    private static func insights(_ s: AnalyticsSummary, progress: UserProgress) -> [String] {
        var out: [String] = []
        let gap = Theme.goal - s.score
        if gap > 0 {
            out.append("\(Theme.percent(gap)) to go to reach the \(Theme.percent(Theme.goal)) goal.")
        } else {
            out.append("You are at or above the \(Theme.percent(Theme.goal)) goal.")
        }

        if s.questionsSeen >= 5 && s.cardsSeen >= 5 {
            if s.questionScore > s.cardScore + 0.15 {
                out.append("Questions are ahead of flashcards. More spaced repetition will lift the score fastest.")
            } else if s.cardScore > s.questionScore + 0.15 {
                out.append("Flashcards are ahead of questions. More Qbank practice will lift the score fastest.")
            }
        }

        let attempts = progress.attempts
        if attempts.count >= 20 {
            let recent = attempts.suffix(10).filter(\.correct).count
            let earlier = attempts.dropLast(10).suffix(10).filter(\.correct).count
            if recent >= earlier + 2 {
                out.append("Trending up: \(recent)/10 on your latest questions versus \(earlier)/10 before.")
            } else if earlier >= recent + 2 {
                out.append("Trending down: \(recent)/10 on your latest questions versus \(earlier)/10 before.")
            }
        }

        let slipping = progress.cardStates.values.filter { $0.lapses >= 3 }.count
        if slipping > 0 {
            out.append("\(slipping) flashcard\(slipping == 1 ? " keeps" : "s keep") slipping. Read those explanations slowly.")
        }

        let untouched = s.topics.filter { !$0.started }.count
        if untouched > 0 && s.hasData {
            out.append("\(untouched) of \(s.topics.count) topics not started yet.")
        }
        if s.streak >= 2 {
            out.append("\(s.streak)-day study streak.")
        }
        return out
    }
}
