import SwiftUI

struct AnalyticsView: View {
    @Environment(ProgressStore.self) private var progress
    private let store = ContentStore.shared

    var body: some View {
        // Recomputed from the shared progress store, so it updates after every question and card.
        let summary = Analytics.summarize(progress: progress.progress, content: store)

        ScrollView {
            VStack(spacing: 28) {
                ScoreHeader(summary: summary)

                if summary.hasData {
                    if !summary.insights.isEmpty {
                        section("Insights") {
                            ForEach(summary.insights, id: \.self) { line in
                                Text(line)
                                    .font(.callout)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }

                    section("Topics, weakest first") {
                        ForEach(summary.topics.filter(\.started)) { stat in
                            TopicRow(stat: stat)
                        }
                        let untouched = summary.topics.filter { !$0.started }
                        if !untouched.isEmpty {
                            Text("Not started: " + untouched.map(\.topic).joined(separator: ", "))
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }

                    if !summary.missed.isEmpty {
                        section("Review manually") {
                            ForEach(summary.missed.prefix(12)) { item in
                                MissedRow(item: item)
                            }
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(Theme.background)
        .navigationTitle("Analytics")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(0.6)
                .foregroundStyle(.secondary)
            VStack(spacing: 14) {
                content()
            }
            .padding(16)
            .frame(maxWidth: .infinity)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        }
    }
}

private struct ScoreHeader: View {
    let summary: AnalyticsSummary

    var body: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .stroke(Theme.track, lineWidth: 14)
                Circle()
                    .trim(from: 0, to: max(0.002, summary.score))
                    .stroke(Theme.color(for: summary.score),
                            style: StrokeStyle(lineWidth: 14, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                // Goal marker at 70%.
                Capsule()
                    .fill(Color.primary.opacity(0.55))
                    .frame(width: 3, height: 20)
                    .offset(y: -90)
                    .rotationEffect(.degrees(360 * Theme.goal))

                VStack(spacing: 2) {
                    Text(Theme.percent(summary.score))
                        .font(.system(size: 52, weight: .bold, design: .rounded))
                        .monospacedDigit()
                    Text("Goal \(Theme.percent(Theme.goal))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 180, height: 180)
            .padding(.top, 8)

            Text(summary.hasData ? summary.nextStep
                 : "Answer questions and review flashcards to build your score.")
                .font(.callout)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            HStack(spacing: 0) {
                Metric(value: Theme.percent(summary.questionScore),
                       label: "Qbank \(summary.questionsSeen)/\(summary.questionsTotal)")
                Metric(value: Theme.percent(summary.cardScore),
                       label: "Cards \(summary.cardsSeen)/\(summary.cardsTotal)")
                Metric(value: "\(summary.cardsDue)", label: "Due now")
            }
        }
    }
}

private struct Metric: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct TopicRow: View {
    let stat: TopicStat

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Text(stat.topic).font(.subheadline)
                Spacer()
                Text(Theme.percent(stat.score))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.color(for: stat.score))
            }
            ScoreBar(value: stat.score, color: Theme.color(for: stat.score))
        }
    }
}

private struct MissedRow: View {
    let item: MissedItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(item.topic)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
                Spacer()
                Text(item.resolved ? "Now correct" : "Missed \(item.misses)x")
                    .font(.caption)
                    .foregroundStyle(item.resolved ? Theme.good : Theme.bad)
            }
            Text(item.concept)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    NavigationStack { AnalyticsView() }.environment(ProgressStore())
}
