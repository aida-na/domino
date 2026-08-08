import SwiftUI

struct DiscoverView: View {
    @Environment(AuthSession.self) private var auth
    @Environment(AppNavigation.self) private var nav
    @State private var items: [Item] = []
    @State private var discoverStatus: DiscoverStatusResponse?
    @State private var globalTrending: DiscoverGlobalResponse?
    @State private var similarTrending: DiscoverSimilarResponse?
    @State private var friendsTrending: DiscoverFriendsResponse?
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
                    } else {
                        if similarTrending?.optInRequired == true || friendsTrending?.optInRequired == true {
                            optInBanner
                        }

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

                        trendingSection(
                            title: "trending on domino",
                            meta: globalTrending.map { "\($0.items.count) links" } ?? "",
                            items: globalTrending?.items ?? [],
                            countLabel: { n in n == 1 ? "1 person saved this" : "\(n) people saved this" },
                            empty: "Nothing trending yet this week — check back soon."
                        )

                        trendingSection(
                            title: "trending with similar taste",
                            meta: similarTrending.map { "\($0.items.count) links" } ?? "",
                            items: similarTrending?.items ?? [],
                            countLabel: { "\($0) people with similar taste" },
                            empty: similarEmptyMessage
                        )

                        trendingSection(
                            title: "trending among friends",
                            meta: friendsTrending.map { "\($0.friendCount) friends" } ?? "",
                            items: friendsTrending?.items ?? [],
                            countLabel: { n in n == 1 ? "1 friend saved this" : "\(n) friends saved this" },
                            empty: friendsEmptyMessage,
                            showInviteCTA: (discoverStatus?.friendCount ?? 0) == 0 && discoverStatus?.optIn == true
                        )

                        if items.isEmpty
                            && (globalTrending?.items.isEmpty ?? true)
                            && (similarTrending?.items.isEmpty ?? true)
                            && (friendsTrending?.items.isEmpty ?? true) {
                            emptyState
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

    private var optInBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("opt in to see trending saves")
                .font(.dominoBody(15, weight: .semibold))
            Text("Share link URLs anonymously (title + URL only) in profile settings.")
                .font(.dominoBody(13))
                .foregroundStyle(DominoColors.ink3)
            Button { showProfile = true } label: {
                Text("open settings")
                    .font(.dominoBody(13, weight: .semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(DominoColors.ink)
                    .foregroundStyle(DominoColors.bg)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DominoColors.folderTint("Culture"))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var similarEmptyMessage: String {
        guard discoverStatus?.optIn == true else { return "Turn on discover sharing in profile settings." }
        guard discoverStatus?.tasteReady == true else { return "Save a few more links first — we need at least 5 saves to match your taste." }
        return "Nothing trending yet this week."
    }

    private var friendsEmptyMessage: String {
        guard discoverStatus?.optIn == true else { return "Turn on discover sharing in profile settings." }
        guard (discoverStatus?.friendCount ?? 0) > 0 else { return "Invite someone — you'll auto-connect when they join." }
        return "No friend saves this week yet."
    }

    private var inviteShareText: String {
        let url = auth.profile?.inviteURL ?? "https://domino.fyi/login"
        return "i use domino to save links over iMessage. join with my link and we'll connect automatically:\n\(url)"
    }

    private func trendingSection(
        title: String,
        meta: String,
        items: [DiscoverTrendItem],
        countLabel: @escaping (Int) -> String,
        empty: String,
        showInviteCTA: Bool = false
    ) -> some View {
        section(title: title, meta: meta.isEmpty ? " " : meta) {
            if items.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text(empty)
                        .font(.dominoBody(13))
                        .foregroundStyle(DominoColors.ink3)
                    if showInviteCTA {
                        ShareLink(item: inviteShareText) {
                            Text("invite someone")
                                .font(.dominoBody(13, weight: .semibold))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(DominoColors.ink)
                                .foregroundStyle(DominoColors.bg)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(DominoColors.paper)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            } else {
                VStack(spacing: 0) {
                    ForEach(items) { item in
                        if let link = URL(string: item.url) {
                            Link(destination: link) {
                                HStack(alignment: .top, spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(item.title)
                                            .font(.dominoDisplay(16, weight: .semibold))
                                            .foregroundStyle(DominoColors.ink)
                                            .multilineTextAlignment(.leading)
                                            .lineLimit(2)
                                        Text(countLabel(item.saveCount))
                                            .font(.dominoBody(12))
                                            .foregroundStyle(DominoColors.ink3)
                                    }
                                    Spacer()
                                    Image(systemName: "arrow.up.right")
                                        .font(.caption)
                                        .foregroundStyle(DominoColors.ink4)
                                }
                                .padding(14)
                            }
                            if item.id != items.last?.id {
                                Divider().padding(.leading, 14)
                            }
                        }
                    }
                }
                .background(DominoColors.paper)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
        async let fetchedItems = api.getItems(token: token, limit: 500)
        async let status = api.getDiscoverStatus(token: token)
        async let global = api.getGlobalTrending(token: token)
        async let similar = api.getSimilarTasteTrending(token: token)
        async let friends = api.getFriendsTrending(token: token)
        items = (try? await fetchedItems) ?? []
        discoverStatus = try? await status
        globalTrending = try? await global
        similarTrending = try? await similar
        friendsTrending = try? await friends
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
