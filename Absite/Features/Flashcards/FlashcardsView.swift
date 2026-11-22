import SwiftUI

struct FlashcardsView: View {
    @Environment(ProgressStore.self) private var progress
    @State private var queue: [Flashcard] = []
    @State private var revealed = false
    @State private var started = false
    private let store = ContentStore.shared
    private let newPerBatch = 20

    var body: some View {
        VStack(spacing: 0) {
            if let card = queue.first {
                ScrollView {
                    cardView(card)
                        .padding(20)
                }
                .contentShape(Rectangle())
                .onTapGesture { revealed = true }

                buttons
            } else {
                caughtUp
            }
        }
        .background(Theme.background)
        .navigationTitle("Flashcards")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if !queue.isEmpty {
                    Text("\(queue.count) left")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
        .onAppear(perform: refresh)
    }

    private func cardView(_ card: Flashcard) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                TopicChip(topic: card.topic)
                if card.fromMissedQuestion {
                    Text("From a missed question")
                        .font(.caption)
                        .foregroundStyle(Theme.warn)
                }
            }

            Text(Cloze.attributed(card.text, revealed: revealed))
                .font(.title3)
                .lineSpacing(7)
                .fixedSize(horizontal: false, vertical: true)

            if revealed {
                Divider()
                Text(card.extra)
                    .font(.callout)
                    .lineSpacing(4)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Tap to reveal")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, minHeight: 260, alignment: .topLeading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
    }

    private var buttons: some View {
        HStack(spacing: 12) {
            Button { answer(knew: false) } label: {
                Text("Don't know").frame(maxWidth: .infinity)
            }
            .tint(Theme.bad)

            Button { answer(knew: true) } label: {
                Text("Know").frame(maxWidth: .infinity)
            }
            .tint(Theme.good)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(!revealed)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.bar)
    }

    private var caughtUp: some View {
        let remaining = newCards().count
        return ContentUnavailableView {
            Label("All caught up", systemImage: "checkmark.circle")
        } description: {
            Text(remaining > 0
                 ? "No cards are due right now. \(remaining) new cards are waiting."
                 : "No cards are due right now. Come back later for your next reviews.")
        } actions: {
            if remaining > 0 {
                Button("Learn \(min(newPerBatch, remaining)) new cards") {
                    buildQueue(includeNew: true)
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    // MARK: - Queue

    private func refresh() {
        if !started {
            started = true
            buildQueue(includeNew: true)
        } else if queue.isEmpty {
            buildQueue(includeNew: false)
        } else {
            addNewlyMissed()
        }
    }

    /// Cards never studied. Missed-question cards come first, then weak topics, then the rest.
    private func newCards() -> [Flashcard] {
        let states = progress.progress.cardStates
        let fresh = store.deck(for: progress.progress).filter { states[$0.id] == nil }
        let weakTopics = Set(progress.progress.attempts.filter { !$0.correct }.map(\.topic))
        let fromMissed = fresh.filter(\.fromMissedQuestion)
        let rest = fresh.filter { !$0.fromMissedQuestion }.shuffled()
        return fromMissed
            + rest.filter { weakTopics.contains($0.topic) }
            + rest.filter { !weakTopics.contains($0.topic) }
    }

    private func buildQueue(includeNew: Bool) {
        let now = Date()
        let states = progress.progress.cardStates
        let due = store.deck(for: progress.progress)
            .filter { card in
                guard let state = states[card.id] else { return false }
                return state.due <= now
            }
            .sorted { (states[$0.id]?.due ?? now) < (states[$1.id]?.due ?? now) }

        let fresh = newCards()
        let newBatch = includeNew ? Array(fresh.prefix(newPerBatch)) : fresh.filter(\.fromMissedQuestion)
        queue = due + newBatch
        revealed = false
    }

    /// Pull in cards created by Qbank misses since this screen was last open.
    private func addNewlyMissed() {
        let states = progress.progress.cardStates
        let queued = Set(queue.map(\.id))
        let missed = store.deck(for: progress.progress)
            .filter { $0.fromMissedQuestion && states[$0.id] == nil && !queued.contains($0.id) }
        guard !missed.isEmpty else { return }
        queue.insert(contentsOf: missed, at: min(1, queue.count))
    }

    private func answer(knew: Bool) {
        guard let card = queue.first else { return }
        progress.review(card, knew: knew)
        queue.removeFirst()
        if !knew {
            // Bring it back after a few other cards in this same session.
            queue.insert(card, at: min(queue.count, 5))
        }
        revealed = false
    }
}

#Preview {
    NavigationStack { FlashcardsView() }.environment(ProgressStore())
}
