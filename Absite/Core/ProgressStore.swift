import Foundation
import Observation

/// One user's study history, saved on the device after every answer.
/// Every screen reads from here, so Qbank, flashcards and analytics stay in sync.
@Observable
final class ProgressStore {
    private(set) var progress = UserProgress()
    @ObservationIgnored private var user: String?

    func load(user: String) {
        self.user = user
        if let data = try? Data(contentsOf: Self.fileURL(for: user)),
           let saved = try? JSONDecoder().decode(UserProgress.self, from: data) {
            progress = saved
        } else {
            progress = UserProgress()
        }
    }

    func unload() {
        user = nil
        progress = UserProgress()
    }

    func record(_ question: Question, correct: Bool, now: Date = Date()) {
        progress.attempts.append(Attempt(questionID: question.id, topic: question.topic,
                                         correct: correct, date: now))
        if !correct && !progress.missedQuestionIDs.contains(question.id) {
            progress.missedQuestionIDs.append(question.id)
        }
        markActive(now)
        save()
    }

    func review(_ card: Flashcard, knew: Bool, now: Date = Date()) {
        progress.cardStates[card.id] = Scheduler.review(progress.cardStates[card.id], knew: knew, now: now)
        markActive(now)
        save()
    }

    func reset() {
        progress = UserProgress()
        save()
    }

    private func markActive(_ date: Date) {
        progress.activeDays.insert(Calendar.current.startOfDay(for: date))
    }

    private func save() {
        guard let user else { return }
        let url = Self.fileURL(for: user)
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                                 withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(progress) {
            try? data.write(to: url, options: .atomic)
        }
    }

    private static func fileURL(for user: String) -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let safeName = user.lowercased().filter { $0.isLetter || $0.isNumber }
        return base.appendingPathComponent("Absite", isDirectory: true)
            .appendingPathComponent("progress-\(safeName).json")
    }
}
