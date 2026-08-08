import SwiftUI

private let discoverTasteThreshold = 5

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

    private var optInRequired: Bool {
        similarTrending?.optInRequired == true || friendsTrending?.optInRequired == true
    }

    private var saveCount: Int { discoverStatus?.itemCount ?? items.count }
    private var savesToTaste: Int { max(0, discoverTasteThreshold - saveCount) }
    private var showTasteProgress: Bool { !optInRequired && savesToTaste > 0 }
    private var showInviteCard: Bool { !optInRequired && (discoverStatus?.friendCount ?? 0) == 0 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    HStack(alignment: .center) {
                        DominoPageTitle(title: "discover", size: 34)
                        Spacer()
                        DominoAvatarButton(letter: avatarLetter) {
                            showProfile = true
                        }
                    }

                    if isLoading {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    } else {
                        if optInRequired {
                            optInBanner
                        }

                        if !topics.isEmpty {
                            collectionsSection
                        }

                        if showTasteProgress {
                            tasteProgressCard
                        }

                        if showInviteCard {
                            inviteCard
                        }

                        if !thisWeek.isEmpty {
                            thisWeekSection
                        }

                        if let global = globalTrending, !global.items.isEmpty {
                            trendingSection(
                                title: "trending on domino",
                                meta: "\(global.items.count) links",
                                items: global.items,
                                countLabel: { n in n == 1 ? "1 person saved this" : "\(n) people saved this" }
                            )
                        }

                        if let similar = similarTrending, !similar.items.isEmpty {
                            trendingSection(
                                title: "trending with similar taste",
                                meta: "\(similar.items.count) links",
                                items: similar.items,
                                countLabel: { "\($0) people with similar taste" }
                            )
                        }

                        if let friends = friendsTrending, !friends.items.isEmpty {
                            trendingSection(
                                title: "trending among friends",
                                meta: "\(friends.friendCount) friends",
                                items: friends.items,
                                countLabel: { n in n == 1 ? "1 friend saved this" : "\(n) friends saved this" }
                            )
                        }

                        if items.isEmpty
                            && (globalTrending?.items.isEmpty ?? true)
                            && (similarTrending?.items.isEmpty ?? true)
                            && (friendsTrending?.items.isEmpty ?? true)
                            && !showTasteProgress
                            && !showInviteCard {
                            emptyState
                        }
                    }
                }
                .padding(.horizontal, 22)
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

    // MARK: - Opt-in

    private var optInBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("opt in to see personalized trending")
                .font(.dominoBody(16, weight: .semibold))
                .foregroundStyle(DominoColors.ink)
            Text("share link urls anonymously (title + url only) to unlock similar-taste and friends trending.")
                .font(.dominoBody(14))
                .foregroundStyle(DominoColors.ink2)
                .lineSpacing(2)
                .padding(.bottom, 6)
            Button { showProfile = true } label: {
                Text("open settings")
                    .font(.dominoBody(14, weight: .semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 11)
                    .background(DominoColors.accent)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DominoColors.card("o"))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    // MARK: - Collections

    private var collectionsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("your collections")
                    .font(.dominoBody(16, weight: .semibold))
                    .foregroundStyle(DominoColors.ink)
                Spacer()
                Text("\(topics.count) folders")
                    .font(.dominoBody(14))
                    .foregroundStyle(DominoColors.ink3)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(topics.prefix(12), id: \.0) { topic, count in
                        Button {
                            nav.pendingFolderFilter = topic
                            nav.selectedTab = 0
                        } label: {
                            VStack(alignment: .leading, spacing: 0) {
                                DotRow(
                                    tones: Array(repeating: DominoColors.ink3.opacity(0.55), count: min(count, 3)),
                                    size: 9
                                )
                                Spacer(minLength: 0)
                                Text(topic)
                                    .font(.dominoDisplay(20, weight: .bold))
                                    .foregroundStyle(DominoColors.ink)
                                    .lineLimit(1)
                                Text("\(count) save\(count == 1 ? "" : "s")")
                                    .font(.dominoBody(12))
                                    .foregroundStyle(DominoColors.ink3)
                                    .padding(.top, 2)
                            }
                            .padding(16)
                            .frame(width: 150, height: 104, alignment: .leading)
                            .background(DominoColors.folderTint(topic))
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .mask(
                LinearGradient(
                    stops: [
                        .init(color: .black, location: 0),
                        .init(color: .black, location: 0.88),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
        }
    }

    // MARK: - Taste progress

    private var tasteProgressCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("YOUR MAP IS STILL FORMING")
                .font(.dominoBody(12, weight: .semibold))
                .tracking(1.1)
                .foregroundStyle(DominoColors.ink4)

            Text("\(saveCount) of \(discoverTasteThreshold) saves until domino can find your people.")
                .font(.dominoDisplay(25, weight: .bold))
                .foregroundStyle(DominoColors.bg)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                ForEach(0..<discoverTasteThreshold, id: \.self) { index in
                    Capsule()
                        .fill(index < saveCount ? DominoColors.accent : DominoColors.ink2)
                        .frame(height: 5)
                }
            }
            .padding(.top, 2)

            Text("\(savesToTaste) more and we'll surface what people with your taste are reading.")
                .font(.dominoBody(14))
                .foregroundStyle(DominoColors.ink4)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DominoColors.ink)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    // MARK: - Invite

    private var inviteShareText: String {
        let url = auth.profile?.inviteURL ?? "https://domino.fyi/login"
        return "i use domino to save links over iMessage. join with my link and we'll connect automatically:\n\(url)"
    }

    private var inviteCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: -10) {
                ForEach(["o", "v", "m"], id: \.self) { key in
                    Circle()
                        .fill(DominoColors.card(key))
                        .frame(width: 34, height: 34)
                        .overlay(Circle().stroke(DominoColors.paper, lineWidth: 2))
                }
                Circle()
                    .fill(DominoColors.chipIdle)
                    .frame(width: 34, height: 34)
                    .overlay(Circle().stroke(DominoColors.paper, lineWidth: 2))
                    .overlay(
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(DominoColors.ink3)
                    )
            }

            Text("invite the friend who sends you things — you'll auto-connect when they join.")
                .font(.dominoBody(17, weight: .semibold))
                .foregroundStyle(DominoColors.ink)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)

            ShareLink(item: inviteShareText) {
                Text("invite someone")
                    .font(.dominoBody(15, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(DominoColors.accent)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
            .simultaneousGesture(TapGesture().onEnded {
                DominoAnalytics.capture("discover_friends_empty_cta_clicked")
            })
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 10, y: 2)
    }

    // MARK: - This week

    private var thisWeekSection: some View {
        section(title: "this week", meta: "\(thisWeek.count) new saves") {
            VStack(spacing: 0) {
                ForEach(Array(thisWeek.prefix(8).enumerated()), id: \.element.id) { index, bookmark in
                    Button {
                        openItem(bookmark)
                    } label: {
                        HStack(alignment: .center, spacing: 12) {
                            Text(String(format: "%02d", index + 1))
                                .font(.dominoBody(13, weight: .bold))
                                .foregroundStyle(DominoColors.ink4)
                                .frame(width: 22, alignment: .leading)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(bookmark.title ?? bookmark.kind.rawValue)
                                    .font(.dominoBody(14, weight: .semibold))
                                    .foregroundStyle(DominoColors.ink)
                                    .multilineTextAlignment(.leading)
                                    .lineLimit(1)
                                Text([bookmark.domain, BookmarkMapper.timeAgo(days: bookmark.days)]
                                    .compactMap { $0 }
                                    .joined(separator: " · "))
                                    .font(.dominoBody(12))
                                    .foregroundStyle(DominoColors.ink3)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 13)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if index < min(thisWeek.count, 8) - 1 {
                        Rectangle()
                            .fill(DominoColors.hairline.opacity(0.6))
                            .frame(height: 1)
                    }
                }
            }
            .padding(.horizontal, 18)
            .background(DominoColors.paper)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
        }
    }

    // MARK: - Trending

    private func trendingSection(
        title: String,
        meta: String,
        items: [DiscoverTrendItem],
        countLabel: @escaping (Int) -> String
    ) -> some View {
        section(title: title, meta: meta) {
            VStack(spacing: 0) {
                ForEach(items) { item in
                    if let link = URL(string: item.url) {
                        Link(destination: link) {
                            HStack(spacing: 12) {
                                Text(URL(string: item.url)?.host?
                                    .replacingOccurrences(of: "www.", with: "")
                                    .prefix(1).uppercased() ?? "↗")
                                    .font(.dominoBody(13, weight: .bold))
                                    .foregroundStyle(DominoColors.ink3)
                                    .frame(width: 40, height: 40)
                                    .background(DominoColors.folderTint(item.topic ?? "Inbox"))
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.title)
                                        .font(.dominoBody(14, weight: .semibold))
                                        .foregroundStyle(DominoColors.ink)
                                        .multilineTextAlignment(.leading)
                                        .lineLimit(1)
                                    Text(countLabel(item.saveCount))
                                        .font(.dominoBody(12))
                                        .foregroundStyle(DominoColors.ink3)
                                }
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(DominoColors.ink4)
                            }
                            .padding(.vertical, 14)
                        }
                        if item.id != items.last?.id {
                            Rectangle()
                                .fill(DominoColors.hairline.opacity(0.6))
                                .frame(height: 1)
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .background(DominoColors.paper)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
        }
    }

    private func section<Content: View>(title: String, meta: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.dominoBody(16, weight: .semibold))
                    .foregroundStyle(DominoColors.ink)
                Spacer()
                if !meta.isEmpty {
                    Text(meta)
                        .font(.dominoBody(14))
                        .foregroundStyle(DominoColors.ink3)
                }
            }
            content()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            DominoProgressDots(filled: 0, total: 3, size: 9)
            Text("nothing here yet. save links over iMessage and patterns will start to show up.")
                .font(.dominoBody(16))
                .foregroundStyle(DominoColors.ink3)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 12)
        .padding(.top, 40)
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
