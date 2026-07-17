import SwiftUI

enum DominoColors {
    static let accent = Color(red: 0.93, green: 0.45, blue: 0.22)
    static let accentDeep = Color(red: 0.85, green: 0.38, blue: 0.16)

    static let bg = Color(red: 0.985, green: 0.978, blue: 0.968)
    static let paper = Color.white
    static let ink = Color(red: 0.14, green: 0.12, blue: 0.10)
    static let ink2 = Color(red: 0.28, green: 0.26, blue: 0.24)
    static let ink3 = Color(red: 0.48, green: 0.46, blue: 0.43)
    static let ink4 = Color(red: 0.68, green: 0.66, blue: 0.63)
    static let hairline = Color(red: 0.90, green: 0.88, blue: 0.85)

    static let pinned = Color(red: 0.98, green: 0.93, blue: 0.88)
    static let chipIdle = Color(red: 0.945, green: 0.935, blue: 0.92)

    static func card(_ key: String) -> Color {
        switch key {
        case "y": return Color(red: 0.97, green: 0.95, blue: 0.88)
        case "p": return Color(red: 0.94, green: 0.90, blue: 0.92)
        case "v": return Color(red: 0.93, green: 0.90, blue: 0.95)
        case "o": return Color(red: 0.98, green: 0.93, blue: 0.88)
        case "m": return Color(red: 0.88, green: 0.94, blue: 0.93)
        case "b": return Color(red: 0.91, green: 0.94, blue: 0.97)
        default: return Color(red: 0.945, green: 0.935, blue: 0.92)
        }
    }

    static func folderTint(_ name: String) -> Color {
        card(BookmarkMapper.hashColor(name))
    }

    static func tagTint(_ name: String) -> Color {
        card(BookmarkMapper.hashColor(name))
    }
}

struct DominoWordmark: View {
    var size: CGFloat = 42
    var showMark: Bool = true

    private var markSize: CGFloat { size * 0.82 }

    var body: some View {
        HStack(spacing: size * 0.22) {
            if showMark {
                Image("DominoMark")
                    .resizable()
                    .scaledToFill()
                    .frame(width: markSize, height: markSize)
                    .clipShape(RoundedRectangle(cornerRadius: markSize * 0.22, style: .continuous))
            }

            (Text("domino").foregroundStyle(DominoColors.ink) + Text(".").foregroundStyle(DominoColors.accent))
                .font(.dominoDisplay(size, weight: .bold))
                .tracking(-0.6)
                .textCase(.lowercase)
        }
    }
}

struct DominoPageTitle: View {
    let title: String
    var size: CGFloat = 36

    var body: some View {
        Text(title)
            .font(.dominoDisplay(size, weight: .bold))
            .foregroundStyle(DominoColors.ink)
            .tracking(-0.6)
            .textCase(.lowercase)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
