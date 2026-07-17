import SwiftUI

struct ItemCardView: View {
    let bookmark: Bookmark
    var sessionToken: String?
    var highlightQuery: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if bookmark.pinned {
                Text("pinned")
                    .font(.dominoBody(11, weight: .bold))
                    .foregroundStyle(DominoColors.accent)
            }

            if bookmark.kind == .image, let mediaURL = bookmark.mediaURL, let token = sessionToken {
                AuthenticatedAsyncImage(urlString: mediaURL, token: token)
                    .frame(maxWidth: .infinity)
                    .frame(height: 120)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            HighlightedTitle(
                text: bookmark.title ?? bookmark.domain ?? bookmark.kind.rawValue,
                query: highlightQuery,
                size: 20
            )
            .lineLimit(2)
            .multilineTextAlignment(.leading)

            if let snippet = bookmark.snippet, !snippet.isEmpty {
                Text(snippet)
                    .font(.dominoBody(14))
                    .foregroundStyle(DominoColors.ink2)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }

            HStack(spacing: 8) {
                if let topic = bookmark.categories.first {
                    Text(topic)
                        .font(.dominoBody(12, weight: .medium))
                        .foregroundStyle(DominoColors.ink2)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(DominoColors.card(bookmark.colorKey).opacity(bookmark.pinned ? 0.55 : 1))
                        .clipShape(Capsule())
                }

                if bookmark.checklistTotal > 0 {
                    Text("\(bookmark.checklistDone)/\(bookmark.checklistTotal)")
                        .font(.dominoBody(12, weight: .medium))
                        .foregroundStyle(DominoColors.ink3)
                }

                Spacer()

                if bookmark.starred {
                    Image(systemName: "star.fill")
                        .font(.caption2)
                        .foregroundStyle(Color(red: 0.92, green: 0.72, blue: 0.2))
                }

                Text(BookmarkMapper.timeAgo(days: bookmark.days))
                    .font(.dominoBody(12))
                    .foregroundStyle(DominoColors.ink4)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(bookmark.pinned ? DominoColors.pinned : DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 10, y: 3)
    }
}
