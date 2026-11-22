import SwiftUI

/// Parses cloze text such as "Treat with {{dantrolene}}."
enum Cloze {
    struct Segment: Equatable {
        let text: String
        let isCloze: Bool
    }

    static func segments(_ text: String) -> [Segment] {
        var result: [Segment] = []
        var rest = Substring(text)
        while let open = rest.range(of: "{{") {
            if open.lowerBound > rest.startIndex {
                result.append(Segment(text: String(rest[rest.startIndex..<open.lowerBound]), isCloze: false))
            }
            let after = rest[open.upperBound...]
            guard let close = after.range(of: "}}") else {
                result.append(Segment(text: String(after), isCloze: false))
                return result
            }
            result.append(Segment(text: String(after[after.startIndex..<close.lowerBound]), isCloze: true))
            rest = after[close.upperBound...]
        }
        if !rest.isEmpty {
            result.append(Segment(text: String(rest), isCloze: false))
        }
        return result
    }

    /// The full sentence with the answers filled in.
    static func plain(_ text: String) -> String {
        segments(text).map(\.text).joined()
    }

    static func attributed(_ text: String, revealed: Bool) -> AttributedString {
        var out = AttributedString()
        for segment in segments(text) {
            if segment.isCloze {
                var part = AttributedString(revealed ? segment.text : "[ ... ]")
                part.foregroundColor = revealed ? Theme.good : Color.accentColor
                part.inlinePresentationIntent = .stronglyEmphasized
                out.append(part)
            } else {
                out.append(AttributedString(segment.text))
            }
        }
        return out
    }
}
