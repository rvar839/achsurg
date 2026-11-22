import Foundation

/// Two-button spaced repetition. "Know" pushes the card further out;
/// "Don't know" brings it back within minutes and shortens its future intervals.
enum Scheduler {
    static let intervalsInDays: [Double] = [1, 3, 7, 14, 30, 60, 120]
    static let relearnDelay: TimeInterval = 10 * 60

    static func review(_ state: CardState?, knew: Bool, now: Date) -> CardState {
        var next = state ?? CardState(box: 0, due: now)
        next.reviews += 1
        next.lastReviewed = now
        if knew {
            let index = min(next.box, intervalsInDays.count - 1)
            // Cards that keep slipping come back sooner.
            let ease = max(0.5, 1.0 - 0.15 * Double(next.lapses))
            next.due = now.addingTimeInterval(intervalsInDays[index] * 86_400 * ease)
            next.box = min(next.box + 1, intervalsInDays.count)
        } else {
            next.lapses += 1
            next.box = 0
            next.due = now.addingTimeInterval(relearnDelay)
        }
        return next
    }
}
