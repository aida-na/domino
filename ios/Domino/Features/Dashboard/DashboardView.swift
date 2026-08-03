import SwiftUI

enum ItemSort: String, CaseIterable {
    case newest = "newest"
    case oldest = "oldest"
    case starred = "starred"
    case az = "A → Z"
}

struct DashboardView: View {
    @Environment(AuthSession.self) private var auth
    @Environment(AppNavigation.self) private var nav
    @State private var items: [Item] = []
    @State private var search = ""
    @State private var folderFilter: String?
    @State private var mediaFilter: MediaFilter?
    @State private var sort: ItemSort = .newest
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showNoteEditor = false
    @State private var editingItem: Item?
    @State private var selectedBookmark: Bookmark?
    @State private var showOnboarding = false
    @State private var profileEmail: String?

    private let api = DominoAPI()

    private var folders: [String] {
        let topics = items.flatMap { item in
            BookmarkMapper.toBookmark(item).displayCategories
        }
        return Array(Set(topics)).sorted {
            $0.localizedCaseInsensitiveCompare($1) == .orderedAscending
        }
    }

    private var availableMediaFilters: [MediaFilter] {
        let kinds = Set(items.map(\.inputType))
        return MediaFilter.allCases.filter { filter in
            switch filter {
            case .notes: kinds.contains(.note)
            case .links: kinds.contains(.link) || kinds.contains(.pdf)
            case .images: kinds.contains(.image)
            }
        }
    }

    private var bookmarks: [Bookmark] {
        var result = items.map(BookmarkMapper.toBookmark)

        if let folderFilter {
            result = result.filter { $0.categories.contains(folderFilter) }
        }

        if let mediaFilter {
            result = result.filter { mediaFilter.matches($0.kind) }
        }

        if !search.isEmpty {
            let q = search.lowercased()
            result = result.filter { b in
                let item = items.first(where: { $0.id == b.id })
                return (b.title?.lowercased().contains(q) ?? false)
                    || (b.url?.lowercased().contains(q) ?? false)
                    || (b.snippet?.lowercased().contains(q) ?? false)
                    || b.body.lowercased().contains(q)
                    || (item?.rawInput.lowercased().contains(q) ?? false)
                    || b.categories.contains(where: { $0.lowercased().contains(q) })
            }
        }

        result.sort { lhs, rhs in
            if lhs.pinned != rhs.pinned { return lhs.pinned && !rhs.pinned }
            switch sort {
            case .newest: return lhs.days < rhs.days
            case .oldest: return lhs.days > rhs.days
            case .starred:
                if lhs.starred != rhs.starred { return lhs.starred && !rhs.starred }
                return lhs.days < rhs.days
            case .az:
                return (lhs.title ?? "").localizedCaseInsensitiveCompare(rhs.title ?? "") == .orderedAscending
            }
        }

        return result
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                List {
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                            .listRowInsets(EdgeInsets())
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                    } else if let errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                    } else if bookmarks.isEmpty {
                        emptyState
                            .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                    } else {
                        ForEach(bookmarks) { bookmark in
                            savedItemRow(bookmark)
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(DominoColors.bg)
                .contentMargins(.bottom, 110, for: .scrollContent)
                .safeAreaInset(edge: .top, spacing: 0) {
                    dashboardHeader
                        .background(DominoColors.bg)
                }

                DominoFAB {
                    editingItem = nil
                    showNoteEditor = true
                }
                .padding(.trailing, 22)
                .padding(.bottom, 22)

                if showOnboarding {
                    OnboardingView(
                        hasItems: !items.isEmpty,
                        hasEmail: !(profileEmail ?? "").isEmpty,
                        initialEmail: profileEmail,
                        onComplete: { showOnboarding = false },
                        onEmailSaved: { profileEmail = $0 }
                    )
                    .transition(.opacity)
                    .zIndex(100)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .navigationBar)
            .refreshable { await loadItems() }
            .task { await loadItems() }
            .onChange(of: nav.pendingDashboardSort) { _, pending in
                guard let pending else { return }
                sort = pending
                nav.pendingDashboardSort = nil
            }
            .onChange(of: nav.pendingFolderFilter) { _, folder in
                guard let folder else { return }
                folderFilter = folder
                nav.pendingFolderFilter = nil
            }
            .onAppear {
                if let pending = nav.pendingDashboardSort {
                    sort = pending
                    nav.pendingDashboardSort = nil
                }
                if let folder = nav.pendingFolderFilter {
                    folderFilter = folder
                    nav.pendingFolderFilter = nil
                }
            }
            .fullScreenCover(isPresented: $showNoteEditor) {
                NoteEditorView(
                    item: editingItem,
                    folders: folders,
                    onChanged: { item in upsert(item) },
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
                    onToggleStar: { Task { await toggleStar(bookmark) } },
                    onTogglePin: { Task { await togglePin(bookmark) } },
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

    private var dashboardHeader: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .center) {
                DominoPageTitle(title: "saved")
                Spacer()
            }
            .padding(.horizontal, 20)

            HStack(spacing: 10) {
                DominoSearchField(text: $search, placeholder: "search notes")
                Menu {
                    Section("sort") {
                        ForEach(ItemSort.allCases, id: \.self) { option in
                            Button {
                                sort = option
                            } label: {
                                HStack {
                                    Text(option.rawValue)
                                    if sort == option {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    }
                    if availableMediaFilters.count > 1 {
                        Section("type") {
                            Button {
                                mediaFilter = nil
                            } label: {
                                HStack {
                                    Text("all")
                                    if mediaFilter == nil {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                            ForEach(availableMediaFilters, id: \.self) { filter in
                                Button {
                                    mediaFilter = filter
                                } label: {
                                    HStack {
                                        Text(filter.rawValue)
                                        if mediaFilter == filter {
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                }
                            }
                        }
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(mediaFilter != nil ? DominoColors.accent : DominoColors.ink2)
                        .frame(width: 44, height: 44)
                        .background(DominoColors.paper)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(
                                    mediaFilter != nil ? DominoColors.accent : DominoColors.hairline,
                                    lineWidth: mediaFilter != nil ? 1.5 : 1
                                )
                        )
                }
                .accessibilityLabel("filter and sort")
            }
            .padding(.horizontal, 20)

            if !items.isEmpty {
                DominoFilterRow(folders: folders, selected: $folderFilter)
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private func savedItemRow(_ bookmark: Bookmark) -> some View {
        ItemCardView(
            bookmark: bookmark,
            sessionToken: auth.sessionToken,
            highlightQuery: search
        )
        .listRowInsets(EdgeInsets(top: 6, leading: 20, bottom: 6, trailing: 20))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.clear)
        .contentShape(Rectangle())
        .onTapGesture { openItem(bookmark) }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task { await deleteItem(bookmark.id) }
            } label: {
                Label("delete", systemImage: "trash")
            }
            Button {
                Task { await togglePin(bookmark) }
            } label: {
                Label(bookmark.pinned ? "unpin" : "pin", systemImage: bookmark.pinned ? "pin.slash" : "pin")
            }
            .tint(DominoColors.accent)
            Button {
                Task { await toggleStar(bookmark) }
            } label: {
                Label(bookmark.starred ? "unstar" : "star", systemImage: bookmark.starred ? "star.slash" : "star")
            }
            .tint(Color(red: 0.92, green: 0.72, blue: 0.2))
        }
        .swipeActions(edge: .leading, allowsFullSwipe: bookmark.kind == .note) {
            if bookmark.kind == .note {
                Button {
                    openNote(id: bookmark.id)
                } label: {
                    Label("edit", systemImage: "pencil")
                }
                .tint(DominoColors.ink2)
            }
        }
        .contextMenu {
            if bookmark.kind == .note {
                Button("edit") { openNote(id: bookmark.id) }
            }
            Button(bookmark.starred ? "unstar" : "star") {
                Task { await toggleStar(bookmark) }
            }
            Button(bookmark.pinned ? "unpin" : "pin") {
                Task { await togglePin(bookmark) }
            }
            Button("delete", role: .destructive) {
                Task { await deleteItem(bookmark.id) }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("nothing here yet")
                .font(.dominoDisplay(22, weight: .bold))
            Text(emptyCopy)
                .font(.dominoBody(15))
                .foregroundStyle(DominoColors.ink3)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 48)
    }

    private var emptyCopy: String {
        if !search.isEmpty { return "try a different search." }
        if mediaFilter != nil { return "nothing saved here yet." }
        if folderFilter != nil { return "no notes in this folder yet." }
        return "send a link over iMessage — or tap + to jot a note."
    }

    private func openItem(_ bookmark: Bookmark) {
        if bookmark.kind == .note {
            openNote(id: bookmark.id)
        } else {
            selectedBookmark = bookmark
        }
    }

    private func openNote(id: String) {
        editingItem = items.first(where: { $0.id == id })
        showNoteEditor = true
    }

    private func upsert(_ item: Item) {
        if let idx = items.firstIndex(where: { $0.id == item.id }) {
            items[idx] = item
        } else {
            items.insert(item, at: 0)
        }
    }

    private func loadItems() async {
        guard let token = auth.sessionToken else { return }
        isLoading = items.isEmpty
        errorMessage = nil
        do {
            items = try await api.getItems(token: token, limit: 500)
            if let profile = try? await api.getMe(token: token) {
                profileEmail = profile.email
            }
            evaluateOnboarding()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func evaluateOnboarding() {
        guard !OnboardingStore.isDone else { return }
        let hasEmail = !(profileEmail ?? "").isEmpty
        if !items.isEmpty && hasEmail {
            OnboardingStore.markDone()
            return
        }
        showOnboarding = true
    }

    private func toggleStar(_ bookmark: Bookmark) async {
        guard let token = auth.sessionToken else { return }
        if let idx = items.firstIndex(where: { $0.id == bookmark.id }) {
            let item = items[idx]
            do {
                let updated = try await api.patchItem(
                    token: token,
                    id: item.id,
                    patch: ItemPatch(isFavorited: !item.isFavorited)
                )
                items[idx] = updated
                if selectedBookmark?.id == bookmark.id {
                    selectedBookmark = BookmarkMapper.toBookmark(updated)
                }
                DominoAnalytics.capture("item_favorite_updated", properties: ["is_favorited": updated.isFavorited])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func togglePin(_ bookmark: Bookmark) async {
        guard let token = auth.sessionToken else { return }
        if let idx = items.firstIndex(where: { $0.id == bookmark.id }) {
            let item = items[idx]
            do {
                let updated = try await api.patchItem(
                    token: token,
                    id: item.id,
                    patch: ItemPatch(isPinned: !item.isPinned)
                )
                items[idx] = updated
                if selectedBookmark?.id == bookmark.id {
                    selectedBookmark = BookmarkMapper.toBookmark(updated)
                }
                DominoAnalytics.capture("item_pin_updated", properties: ["is_pinned": updated.isPinned])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func deleteItem(_ id: String) async {
        guard let token = auth.sessionToken else { return }
        do {
            try await api.deleteItem(token: token, id: id)
            items.removeAll { $0.id == id }
            DominoAnalytics.capture("item_deleted")
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ItemDetailSheet: View {
    let bookmark: Bookmark
    var sessionToken: String?
    let onToggleStar: () -> Void
    var onTogglePin: (() -> Void)? = nil
    var onDelete: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var confirmDelete = false

    private var displaySnippet: String? {
        guard let snippet = bookmark.snippet?.trimmingCharacters(in: .whitespacesAndNewlines),
              !snippet.isEmpty else { return nil }
        let title = (bookmark.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !title.isEmpty else { return snippet }
        let body = snippet.lowercased()
        if body == title || body.hasPrefix(title) || title.hasPrefix(body) { return nil }
        return snippet
    }

    private var metaLine: String {
        var parts: [String] = []
        if let domain = bookmark.domain { parts.append(domain) }
        if let topic = bookmark.categories.first, !topic.isEmpty {
            parts.append(topic.lowercased())
        }
        parts.append(BookmarkMapper.timeAgo(days: bookmark.days))
        return parts.joined(separator: " · ")
    }

    private var needsLargeSheet: Bool {
        (displaySnippet?.count ?? 0) > 120 || bookmark.keyIdeas.count > 2 || bookmark.kind == .image
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if bookmark.kind == .image, let mediaURL = bookmark.mediaURL, let token = sessionToken {
                        AuthenticatedAsyncImage(urlString: mediaURL, token: token)
                            .frame(maxWidth: .infinity)
                            .frame(height: 160)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }

                    Text(bookmark.displayTitle)
                        .font(.dominoDisplay(22, weight: .bold))
                        .foregroundStyle(DominoColors.ink)
                        .textCase(.lowercase)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(metaLine)
                        .font(.dominoBody(13))
                        .foregroundStyle(DominoColors.ink3)

                    if let snippet = displaySnippet {
                        Text(snippet)
                            .font(.dominoBody(15))
                            .foregroundStyle(DominoColors.ink2)
                            .lineLimit(needsLargeSheet ? nil : 4)
                    }

                    if !bookmark.keyIdeas.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("key ideas")
                                .font(.dominoBody(13, weight: .semibold))
                                .foregroundStyle(DominoColors.ink3)
                            ForEach(bookmark.keyIdeas, id: \.self) { idea in
                                Text("· \(idea)")
                                    .font(.dominoBody(14))
                                    .foregroundStyle(DominoColors.ink2)
                            }
                        }
                    }

                    actionRow
                }
                .padding(20)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(DominoColors.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    DominoCloseButton { dismiss() }
                }
            }
            .confirmationDialog("delete this save?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("delete", role: .destructive) {
                    onDelete?()
                    dismiss()
                }
            }
        }
        .presentationDetents(needsLargeSheet ? [.medium, .large] : [.fraction(0.42), .medium])
        .presentationDragIndicator(.visible)
    }

    private var actionRow: some View {
        HStack(spacing: 10) {
            DominoIconButton(
                systemName: bookmark.starred ? "star.fill" : "star",
                accessibilityLabel: bookmark.starred ? "unstar" : "star",
                tint: bookmark.starred ? Color(red: 0.92, green: 0.72, blue: 0.2) : DominoColors.ink2
            ) { onToggleStar() }

            if let onTogglePin {
                DominoIconButton(
                    systemName: bookmark.pinned ? "pin.fill" : "pin",
                    accessibilityLabel: bookmark.pinned ? "unpin" : "pin",
                    tint: bookmark.pinned ? DominoColors.accent : DominoColors.ink2
                ) { onTogglePin() }
            }

            if onDelete != nil {
                DominoIconButton(
                    systemName: "trash",
                    accessibilityLabel: "delete",
                    tint: DominoColors.ink3
                ) { confirmDelete = true }
            }

            Spacer(minLength: 8)

            if let url = bookmark.url, let link = URL(string: url) {
                DominoAccentPillButton(title: "open link", systemImage: "arrow.up.right") {
                    openURL(link)
                }
            }
        }
        .padding(.top, 4)
    }
}

#Preview {
    DashboardView()
        .environment(AuthSession())
        .environment(AppNavigation())
}
