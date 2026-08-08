import SwiftUI

// MARK: - Chrome buttons

struct DominoCloseButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(DominoColors.ink2)
                .frame(width: 32, height: 32)
                .background(DominoColors.chipIdle)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("close")
    }
}

struct DominoIconButton: View {
    let systemName: String
    var accessibilityLabel: String
    var tint: Color = DominoColors.ink2
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 36, height: 36)
                .background(DominoColors.chipIdle)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}

struct DominoAccentPillButton: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .semibold))
                Text(title)
                    .font(.dominoBody(14, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(DominoColors.accent)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Domino dots

/// A row of small dots — the recurring domino motif used for progress and section marks.
struct DotRow: View {
    let tones: [Color]
    var size: CGFloat = 8

    var body: some View {
        HStack(spacing: size < 9 ? 3 : 6) {
            ForEach(Array(tones.enumerated()), id: \.offset) { _, tone in
                Circle().fill(tone).frame(width: size, height: size)
            }
        }
    }
}

struct DominoProgressDots: View {
    let filled: Int
    let total: Int
    var size: CGFloat = 8

    var body: some View {
        DotRow(
            tones: (0..<total).map { $0 < filled ? DominoColors.accent : DominoColors.hairline },
            size: size
        )
    }
}

// MARK: - Settings list

struct DominoSettingsRow: View {
    let systemImage: String
    let title: String
    var detail: String = ""
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: systemImage)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(DominoColors.ink)
                    .frame(width: 20)
                Text(title)
                    .font(.dominoBody(16))
                    .foregroundStyle(DominoColors.ink)
                Spacer()
                if !detail.isEmpty {
                    Text(detail)
                        .font(.dominoBody(14))
                        .foregroundStyle(DominoColors.ink3)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(DominoColors.ink4)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Search field

struct DominoSearchField: View {
    @Binding var text: String
    var placeholder: String = "search notes"
    var isFocused: Bool = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(DominoColors.ink3)
            TextField(placeholder, text: $text)
                .font(.dominoBody(16))
                .foregroundStyle(DominoColors.ink)
                .tint(DominoColors.accent)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(DominoColors.ink4)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(isFocused || !text.isEmpty ? DominoColors.accent : DominoColors.hairline, lineWidth: 1.5)
        )
    }
}

// MARK: - Filter chips

struct DominoFilterChip: View {
    let title: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.dominoBody(14, weight: .medium))
                .foregroundStyle(isActive ? Color.white : DominoColors.ink2)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(isActive ? DominoColors.accent : DominoColors.chipIdle)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

enum MediaFilter: String, CaseIterable, Hashable {
    case notes = "notes"
    case links = "links"
    case images = "images"

    func matches(_ kind: InputType) -> Bool {
        switch self {
        case .notes: kind == .note
        case .links: kind == .link || kind == .pdf
        case .images: kind == .image
        }
    }
}

struct DominoFilterRow: View {
    let folders: [String]
    @Binding var selected: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                DominoFilterChip(title: "all", isActive: selected == nil) {
                    selected = nil
                }
                ForEach(folders, id: \.self) { folder in
                    DominoFilterChip(title: folder.lowercased(), isActive: selected == folder) {
                        selected = folder
                    }
                }
            }
            .padding(.horizontal, 20)
        }
    }
}

// MARK: - FAB

struct DominoFAB: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 58, height: 58)
                .background(DominoColors.accent)
                .clipShape(Circle())
                .shadow(color: DominoColors.accent.opacity(0.35), radius: 12, y: 6)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Profile avatar

struct DominoAvatarButton: View {
    let letter: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(letter)
                .font(.dominoBody(15, weight: .semibold))
                .foregroundStyle(DominoColors.ink)
                .frame(width: 36, height: 36)
                .background(DominoColors.chipIdle)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Tag chip

struct DominoTagChip: View {
    let tag: String

    var body: some View {
        Text("#\(tag)")
            .font(.dominoBody(13, weight: .medium))
            .foregroundStyle(DominoColors.ink2)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(DominoColors.tagTint(tag))
            .clipShape(Capsule())
    }
}

// MARK: - Folder card

struct DominoFolderCard: View {
    let name: String
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(folderIconColor)
                .frame(width: 28, height: 28)

            Spacer(minLength: 0)

            Text(name)
                .font(.dominoDisplay(22, weight: .bold))
                .foregroundStyle(DominoColors.ink)
                .lineLimit(1)

            Text("\(count) note\(count == 1 ? "" : "s")")
                .font(.dominoBody(13))
                .foregroundStyle(DominoColors.ink3)
        }
        .padding(18)
        .frame(maxWidth: .infinity, minHeight: 140, alignment: .leading)
        .background(DominoColors.folderTint(name))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var folderIconColor: Color {
        let key = BookmarkMapper.hashColor(name)
        switch key {
        case "m": return Color(red: 0.35, green: 0.62, blue: 0.58)
        case "o", "y": return DominoColors.accent
        default: return DominoColors.ink3
        }
    }
}

// MARK: - Highlighted title (search)

struct HighlightedTitle: View {
    let text: String
    let query: String
    var size: CGFloat = 20

    var body: some View {
        if query.isEmpty {
            Text(text)
                .font(.dominoDisplay(size, weight: .semibold))
                .foregroundStyle(DominoColors.ink)
        } else {
            highlighted
                .font(.dominoDisplay(size, weight: .semibold))
        }
    }

    private var highlighted: Text {
        let lower = text.lowercased()
        let q = query.lowercased()
        var result = Text("")
        var start = text.startIndex
        while let range = lower.range(of: q, range: start..<lower.endIndex) {
            let before = String(text[start..<range.lowerBound])
            let match = String(text[range])
            result = result + Text(before).foregroundColor(DominoColors.ink)
                + Text(match).foregroundColor(DominoColors.accent)
            start = range.upperBound
        }
        result = result + Text(String(text[start...])).foregroundColor(DominoColors.ink)
        return result
    }
}
