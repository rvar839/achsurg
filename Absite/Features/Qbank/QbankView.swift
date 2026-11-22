import SwiftUI

struct QbankView: View {
    @Environment(ProgressStore.self) private var progress
    @State private var question: Question?
    @State private var selected: Int?
    @State private var answered = 0
    @State private var correctCount = 0
    private let store = ContentStore.shared
    private let letters = ["A", "B", "C", "D", "E", "F"]

    var body: some View {
        ScrollView {
            if let question {
                questionBody(question)
                    .padding(20)
            } else {
                ContentUnavailableView("No questions", systemImage: "questionmark.circle",
                                       description: Text("The question bank is empty."))
                    .padding(.top, 80)
            }
        }
        .background(Theme.background)
        .navigationTitle("Qbank")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if answered > 0 {
                    Text("\(correctCount)/\(answered)")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if selected != nil {
                Button(action: next) {
                    Text("Next question").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(.bar)
            }
        }
        .onAppear {
            if question == nil { next() }
        }
    }

    @ViewBuilder
    private func questionBody(_ q: Question) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            TopicChip(topic: q.topic)

            Text(q.stem)
                .font(.body)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 10) {
                ForEach(Array(q.choices.enumerated()), id: \.offset) { index, choice in
                    ChoiceRow(letter: index < letters.count ? letters[index] : "?",
                              text: choice,
                              state: choiceState(index, in: q)) {
                        choose(index, in: q)
                    }
                }
            }

            if let selected {
                explanation(for: q, wasCorrect: selected == q.answer)
            }
        }
    }

    @ViewBuilder
    private func explanation(for q: Question, wasCorrect: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(wasCorrect ? "Correct" : "Incorrect")
                .font(.headline)
                .foregroundStyle(wasCorrect ? Theme.good : Theme.bad)

            Text(q.explanation)
                .font(.callout)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            Divider()

            Text("KEY POINT")
                .font(.caption2.weight(.semibold))
                .tracking(0.6)
                .foregroundStyle(.secondary)
            Text(Cloze.attributed(q.card.text, revealed: true))
                .font(.callout)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            if !wasCorrect {
                Label("Added to your flashcards", systemImage: "plus.rectangle.on.rectangle")
                    .font(.footnote)
                    .foregroundStyle(Color.accentColor)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private func choiceState(_ index: Int, in q: Question) -> ChoiceRow.State {
        guard let selected else { return .idle }
        if index == q.answer { return .correct }
        if index == selected { return .wrong }
        return .dimmed
    }

    private func choose(_ index: Int, in q: Question) {
        guard selected == nil else { return }
        selected = index
        let correct = index == q.answer
        answered += 1
        if correct { correctCount += 1 }
        progress.record(q, correct: correct)
    }

    /// Random across all topics: unseen questions first, with missed ones mixed back in.
    private func next() {
        let all = store.questions
        let last = progress.progress.lastResults
        let unseen = all.filter { last[$0.id] == nil }
        let missed = all.filter { last[$0.id] == false }

        var pool = all
        if !unseen.isEmpty && (missed.isEmpty || Int.random(in: 0..<4) > 0) {
            pool = unseen
        } else if !missed.isEmpty {
            pool = missed
        }
        let currentID = question?.id
        let candidates = pool.filter { $0.id != currentID }
        selected = nil
        question = (candidates.isEmpty ? pool : candidates).randomElement()
    }
}

struct ChoiceRow: View {
    enum State { case idle, correct, wrong, dimmed }

    let letter: String
    let text: String
    let state: State
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Text(letter)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 22)
                Text(text)
                    .font(.body)
                    .multilineTextAlignment(.leading)
                    .foregroundStyle(state == .dimmed ? Color.secondary : Color.primary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(fill, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(stroke, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    private var tint: Color {
        switch state {
        case .idle: return Color.accentColor
        case .correct: return Theme.good
        case .wrong: return Theme.bad
        case .dimmed: return Color.secondary
        }
    }

    private var fill: Color {
        switch state {
        case .correct: return Theme.good.opacity(0.12)
        case .wrong: return Theme.bad.opacity(0.12)
        default: return Theme.surface
        }
    }

    private var stroke: Color {
        switch state {
        case .correct: return Theme.good
        case .wrong: return Theme.bad
        default: return Color.clear
        }
    }
}

#Preview {
    NavigationStack { QbankView() }.environment(ProgressStore())
}
