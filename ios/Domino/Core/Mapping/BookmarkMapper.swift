import Foundation

struct Bookmark: Identifiable, Hashable {
    let id: String
    let kind: InputType
    let title: String?
    let url: String?
    let mediaURL: String?
    let domain: String?
    let colorKey: String
    let categories: [String]
    /// Full note body (raw_input) for notes; summary snippet for links.
    let body: String
    let snippet: String?
    let keyIdeas: [String]
    let days: Int
    let starred: Bool
    let pinned: Bool
    let checklistDone: Int
    let checklistTotal: Int

    /// Card/detail headline: article title, note first line, or domain for links.
    var displayTitle: String {
        title ?? domain ?? kind.rawValue
    }

    /// Topic pills — hide redundant General when a specific label exists.
    var displayCategories: [String] {
        let cats = categories.filter { !$0.isEmpty }
        if cats.count > 1 {
            return cats.filter { $0.lowercased() != "general" }
        }
        return cats
    }
}

enum BookmarkMapper {
    private static let colorKeys = ["y", "p", "v", "o", "m", "b", "s"]
    private static let checklistRE = try! NSRegularExpression(pattern: #"^- \[[ xX]\] "#, options: .anchorsMatchLines)
    private static let checklistDoneRE = try! NSRegularExpression(pattern: #"^- \[[xX]\] "#, options: .anchorsMatchLines)

    static func hashColor(_ str: String) -> String {
        var h = 0
        for char in str.unicodeScalars {
            h = (h &* 31 &+ Int(char.value)) | 0
        }
        return colorKeys[abs(h) % colorKeys.count]
    }

    static func timeAgo(days: Int) -> String {
        if days < 0 { return "" }
        if days < 1 { return "today" }
        if days < 2 { return "1d ago" }
        if days < 7 { return "\(days)d ago" }
        if days < 30 { return "\(days / 7)w ago" }
        if days < 365 { return "\(days / 30)mo ago" }
        return "\(days / 365)y ago"
    }

    static func faviconLetter(domain: String?) -> String {
        guard let domain, !domain.isEmpty else { return "·" }
        let cleaned = domain.hasPrefix("www.") ? String(domain.dropFirst(4)) : domain
        return String(cleaned.prefix(1)).uppercased()
    }

    static func checklistProgress(in text: String) -> (done: Int, total: Int) {
        let range = NSRange(text.startIndex..., in: text)
        let total = checklistRE.numberOfMatches(in: text, range: range)
        let done = checklistDoneRE.numberOfMatches(in: text, range: range)
        return (done, total)
    }

    static func toBookmark(_ item: Item) -> Bookmark {
        let isLink = item.inputType == .link
        let isNote = item.inputType == .note
        let domain = isLink ? extractDomain(item.rawInput) : nil
        let topics = item.resolvedTopics
        let topic = topics.first ?? "Inbox"
        let progress = isNote ? checklistProgress(in: item.rawInput) : (0, 0)

        return Bookmark(
            id: item.id,
            kind: item.inputType,
            title: extractTitle(item),
            url: isLink ? item.rawInput : nil,
            mediaURL: item.inputType == .image ? item.rawInput : nil,
            domain: domain,
            colorKey: hashColor(topic),
            categories: topics,
            body: item.rawInput,
            snippet: isNote
                ? noteCardSnippet(item.rawInput)
                : item.summary.map { String($0.prefix(200)) },
            keyIdeas: item.keyIdeas,
            days: daysSince(item.createdAt),
            starred: item.isFavorited,
            pinned: item.isPinned,
            checklistDone: progress.0,
            checklistTotal: progress.1
        )
    }

    /// Second line / body preview for cards (not truncated mid-note in the editor).
    private static func noteCardSnippet(_ raw: String) -> String? {
        let lines = raw.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        guard lines.count > 1 else { return nil }
        let rest = lines.dropFirst().joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        if rest.isEmpty { return nil }
        return String(rest.prefix(160))
    }

    private static func extractDomain(_ urlString: String) -> String? {
        guard let url = URL(string: urlString), let host = url.host else { return nil }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    private static let isoWithFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoBasic: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let naiveISOFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f
    }()

    private static func parseISO8601(_ iso: String) -> Date? {
        if let date = isoWithFractional.date(from: iso) { return date }
        if let date = isoBasic.date(from: iso) { return date }
        return naiveISOFormatter.date(from: String(iso.prefix(19)))
    }

    private static func daysSince(_ iso: String?) -> Int {
        guard let iso, let date = parseISO8601(iso) else { return -1 }
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let saved = cal.startOfDay(for: date)
        return max(0, cal.dateComponents([.day], from: saved, to: today).day ?? 0)
    }

    private static func extractTitle(_ item: Item) -> String? {
        if item.inputType == .note {
            let first = item.rawInput.split(separator: "\n", maxSplits: 1).first.map(String.init) ?? ""
            let trimmed = first
                .replacingOccurrences(of: #"^- \[[ xX]\] "#, with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : String(trimmed.prefix(80))
        }
        if let summary = item.summary {
            let first = summary
                .split(separator: "\n", maxSplits: 1)
                .first
                .map(String.init)?
                .replacingOccurrences(of: #"^#+\s*"#, with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !first.isEmpty, first.count < 120 { return first }
        }
        return nil
    }
}

enum NoteChecklist {
    static let uncheckedPrefix = "- [ ] "
    static let checkedPrefix = "- [x] "

    static func toggleLine(_ line: String) -> String {
        if line.hasPrefix("- [x] ") || line.hasPrefix("- [X] ") {
            return "- [ ] " + String(line.dropFirst(6))
        }
        if line.hasPrefix("- [ ] ") {
            return "- [x] " + String(line.dropFirst(6))
        }
        return line
    }

    static func toggleLineInBody(_ body: String, lineIndex: Int) -> String {
        var lines = body.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        guard lineIndex >= 0, lineIndex < lines.count else { return body }
        lines[lineIndex] = toggleLine(lines[lineIndex])
        return lines.joined(separator: "\n")
    }

    static func isChecklistLine(_ line: String) -> Bool {
        line.hasPrefix("- [ ] ") || line.hasPrefix("- [x] ") || line.hasPrefix("- [X] ")
    }

    static func isChecked(_ line: String) -> Bool {
        line.hasPrefix("- [x] ") || line.hasPrefix("- [X] ")
    }

    static func label(for line: String) -> String {
        if isChecklistLine(line) {
            return String(line.dropFirst(6))
        }
        return line
    }
}
