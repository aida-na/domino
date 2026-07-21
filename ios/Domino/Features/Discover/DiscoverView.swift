import SwiftUI

struct DiscoverView: View {
    @Environment(AuthSession.self) private var auth
    @Environment(AppNavigation.self) private var nav
    @State private var items: [Item] = []
    @State private var isLoading = true
    @State private var selectedBookmark: Bookmark?
    @State private var showNoteEditor = false
    @State private var editingItem: Item?
    @State private var showProfile = false

    private let api = DominoAPI()

    private var avatarLetter: String {
        String(auth.phone?.suffix(1) ?? "?").uppercased()
    }

    private var topics: [(String, Int)] {
        var counts: [String: Int] = [:]
        for item in items {
            for label in item.resolvedTopics {
                counts[label, default: 0] += 1
            }
        }
        return counts.map { ($0.key, $0.value) }.sorted { $0.1 > $1.1 }
    }

    private var thisWeek: [Bookmark] {
        items.map(BookmarkMapper.toBookmark)
            .filter { $0.days <= 7 }
            .sorted { $0.days < $1.days }
    }

    private var folders: [String] {
        topics.map(\.0)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    HStack(alignment: .center) {
                        DominoPageTitle(title: "discover")
                        Spacer()
                        DominoAvatarButton(letter: avatarLetter) {
                            showProfile = true
                        }
                    }

                    if isLoading {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    } else if items.isEmpty {
                        emptyState
                    } else {
                        if !topics.isEmpty {
                            section(title: "my collections", meta: "\(topics.count) folders") {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 12) {
                                        ForEach(topics.prefix(12), id: \.0) { topic, count in
                                            Button {
                                                nav.pendingFolderFilter = topic
                                                nav.selectedTab = 0
                                            } label: {
                                                VStack(alignment: .leading, spacing: 8) {
                                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                                        .fill(DominoColors.accent.opacity(0.85))
                                                        .frame(width: 22, height: 22)
                                                    Text(topic)
                                                        .font(.dominoDisplay(18, weight: .bold))
                                                        .foregroundStyle(DominoColors.ink)
                                                        .lineLimit(2)
                                                        .multilineTextAlignment(.leading)
                                                    Text("\(count) save\(count == 1 ? "" : "s")")
                                                        .font(.dominoBody(12))
                                                        .foregroundStyle(DominoColors.ink3)
                                                }
                                                .padding(16)
                                                .frame(width: 148, alignment: .leading)
                                                .background(DominoColors.folderTint(topic))
                                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }
                            }
                        }

                        if !thisWeek.isEmpty {
                            section(title: "this week", meta: "\(thisWeek.count) new saves") {
                                VStack(spacing: 10) {
                                    ForEach(Array(thisWeek.prefix(8).enumerated()), id: \.element.id) { index, bookmark in
                                        Button {
                                            openItem(bookmark)
                                        } label: {
                                            HStack(alignment: .top, spacing: 12) {
                                                Text(String(format: "%02d", index + 1))
                                                    .font(.dominoBody(13, weight: .bold))
                                                    .foregroundStyle(DominoColors.ink4)
                                                    .frame(width: 24, alignment: .leading)
                                                VStack(alignment: .leading, spacing: 4) {
                                                    Text(bookmark.title ?? bookmark.kind.rawValue)
                                                        .font(.dominoDisplay(17, weight: .semibold))
                                                        .foregroundStyle(DominoColors.ink)
                                                        .multilineTextAlignment(.leading)
                                                        .lineLimit(2)
                                                    HStack(spacing: 6) {
                                                        if let domain = bookmark.domain {
                                                            Text(domain)
                                                        }
                                                        Text(BookmarkMapper.timeAgo(days: bookmark.days))
                                                    }
                                                    .font(.dominoBody(12))
                                                    .foregroundStyle(DominoColors.ink3)
                                                }
                                                Spacer()
                                            }
                                            .padding(16)
                                            .background(DominoColors.paper)
                                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                            .shadow(color: .black.opacity(0.03), radius: 8, y: 2)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 100)
            }
            .background(DominoColors.bg)
            .toolbar(.hidden, for: .navigationBar)
            .task { await load() }
            .refreshable { await load() }
            .sheet(item: $selectedBookmark) { bookmark in
                ItemDetailSheet(
                    bookmark: bookmark,
                    sessionToken: auth.sessionToken,
                    onToggleStar: {},
                    onDelete: {
                        Task {
                            await deleteItem(bookmark.id)
                            selectedBookmark = nil
                        }
                    }
                )
            }
            .fullScreenCover(isPresented: $showNoteEditor) {
                NoteEditorView(
                    item: editingItem,
                    folders: folders,
                    onChanged: { item in
                        if let idx = items.firstIndex(where: { $0.id == item.id }) {
                            items[idx] = item
                        }
                    },
                    onDeleted: {
                        if let id = editingItem?.id {
                            items.removeAll { $0.id == id }
                        }
                        editingItem = nil
                    }
                )
                .environment(auth)
            }
            .sheet(isPresented: $showProfile) {
                ProfileView()
                    .environment(auth)
                    .environment(nav)
            }
        }
    }

    private func section<Content: View>(title: String, meta: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.dominoBody(15, weight: .semibold))
                    .foregroundStyle(DominoColors.ink)
                Spacer()
                Text(meta)
                    .font(.dominoBody(12))
                    .foregroundStyle(DominoColors.ink3)
            }
            content()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("nothing here yet")
                .font(.dominoDisplay(22, weight: .bold))
            Text("save links, notes, or ideas via iMessage. patterns will emerge as your library grows.")
                .font(.dominoBody(15))
                .foregroundStyle(DominoColors.ink3)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 48)
    }

    private func openItem(_ bookmark: Bookmark) {
        if bookmark.kind == .note {
            editingItem = items.first(where: { $0.id == bookmark.id })
            showNoteEditor = true
        } else {
            selectedBookmark = bookmark
        }
    }

    private func load() async {
        guard let token = auth.sessionToken else { return }
        isLoading = items.isEmpty
        items = (try? await api.getItems(token: token, limit: 500)) ?? []
        isLoading = false
    }

    private func deleteItem(_ id: String) async {
        guard let token = auth.sessionToken else { return }
        try? await api.deleteItem(token: token, id: id)
        items.removeAll { $0.id == id }
    }
}

#Preview {
    DiscoverView()
        .environment(AuthSession())
        .environment(AppNavigation())
}
