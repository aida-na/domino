import SwiftUI

struct SearchView: View {
    @Environment(AuthSession.self) private var auth
    @State private var items: [Item] = []
    @State private var query = ""
    @State private var isLoading = true
    @State private var selectedBookmark: Bookmark?
    @State private var showNoteEditor = false
    @State private var editingItem: Item?
    @FocusState private var searchFocused: Bool

    private let api = DominoAPI()

    private var recentChips: [String] {
        let words = items
            .compactMap(\.topic)
            .filter { !$0.isEmpty }
        return Array(Set(words)).sorted().prefix(6).map { $0.lowercased() }
    }

    private var results: [Bookmark] {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
        let q = query.lowercased()
        return items.map(BookmarkMapper.toBookmark).filter { b in
            let item = items.first(where: { $0.id == b.id })
            return (b.title?.lowercased().contains(q) ?? false)
                || (b.snippet?.lowercased().contains(q) ?? false)
                || b.body.lowercased().contains(q)
                || (item?.rawInput.lowercased().contains(q) ?? false)
                || b.categories.contains(where: { $0.lowercased().contains(q) })
        }
    }

    private var folders: [String] {
        Array(Set(items.compactMap(\.topic).filter { !$0.isEmpty })).sorted()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    DominoPageTitle(title: "Search")
                        .padding(.horizontal, 20)

                    DominoSearchField(text: $query, placeholder: "search notes", isFocused: !query.isEmpty || searchFocused)
                        .padding(.horizontal, 20)
                        .onTapGesture { searchFocused = true }

                    if query.isEmpty {
                        if !recentChips.isEmpty {
                            FlowChips(chips: recentChips) { chip in
                                query = chip
                            }
                            .padding(.horizontal, 20)
                        }

                        Text("Search titles, notes, and folders.")
                            .font(.dominoBody(14))
                            .foregroundStyle(DominoColors.ink3)
                            .padding(.horizontal, 20)
                            .padding(.top, 12)
                    } else if isLoading {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    } else if results.isEmpty {
                        Text("No matches for “\(query)”")
                            .font(.dominoBody(15))
                            .foregroundStyle(DominoColors.ink3)
                            .padding(.horizontal, 20)
                            .padding(.top, 24)
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(results) { bookmark in
                                ItemCardView(
                                    bookmark: bookmark,
                                    sessionToken: auth.sessionToken,
                                    highlightQuery: query
                                )
                                .onTapGesture { openItem(bookmark) }
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 100)
            }
            .background(DominoColors.bg)
            .toolbar(.hidden, for: .navigationBar)
            .task { await load() }
            .refreshable { await load() }
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
        }
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
        items = (try? await api.getItems(token: token, limit: 500)) ?? items
        isLoading = false
    }

    private func deleteItem(_ id: String) async {
        guard let token = auth.sessionToken else { return }
        try? await api.deleteItem(token: token, id: id)
        items.removeAll { $0.id == id }
    }
}

/// Simple wrapping chip row for recent searches / suggestions.
private struct FlowChips: View {
    let chips: [String]
    let onTap: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(chips, id: \.self) { chip in
                    Button {
                        onTap(chip)
                    } label: {
                        Text(chip)
                            .font(.dominoBody(13, weight: .medium))
                            .foregroundStyle(DominoColors.ink2)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(DominoColors.chipIdle)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

#Preview {
    SearchView()
        .environment(AuthSession())
}
