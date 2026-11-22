import SwiftUI

/// One calm palette used everywhere: indigo accent, soft green / amber / coral for status.
enum Theme {
    static let good = Color(red: 0.18, green: 0.62, blue: 0.49)
    static let warn = Color(red: 0.87, green: 0.62, blue: 0.20)
    static let bad = Color(red: 0.84, green: 0.38, blue: 0.36)

    static let background = Color(.systemGroupedBackground)
    static let surface = Color(.secondarySystemGroupedBackground)
    static let track = Color(.systemGray5)

    /// The score every user is working toward.
    static let goal = 0.70

    static func color(for score: Double) -> Color {
        if score >= goal { return good }
        if score >= 0.5 { return warn }
        return bad
    }

    static func percent(_ value: Double) -> String {
        "\(Int((value * 100).rounded()))%"
    }
}

struct TopicChip: View {
    let topic: String

    var body: some View {
        Text(topic.uppercased())
            .font(.caption2.weight(.semibold))
            .tracking(0.6)
            .foregroundStyle(Color.accentColor)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.accentColor.opacity(0.12), in: Capsule())
    }
}

struct ScoreBar: View {
    let value: Double
    let color: Color

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.track)
                Capsule().fill(color)
                    .frame(width: max(6, geo.size.width * min(max(value, 0), 1)))
            }
        }
        .frame(height: 6)
    }
}
