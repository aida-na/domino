import SwiftUI

enum NoteSaveStatus: Equatable {
    case idle
    case saving
    case saved
    case polishing
    case grabbingLink
    case error(String)

    var label: String? {
        switch self {
        case .idle: return nil
        case .saving: return "saving…"
        case .saved: return "saved"
        case .polishing: return "polishing…"
        case .grabbingLink: return "grabbing title…"
        case .error(let msg): return msg
        }
    }
}

struct NoteEditorView: View {
    @Environment(AuthSession.self) private var auth
    @Environment(\.dismiss) private var dismiss

    /// Existing item id when editing; nil when composing a new note.
    @State private var itemId: String?
    @State private var itemKind: InputType?
    @State private var text: String
    @State private var folder: String
    @State private var keyIdeas: [String]
    @State private var starred: Bool
    @State private var pinned: Bool
    @State private var status: NoteSaveStatus = .idle
    @State private var showFolderPicker = false
    @State private var availableFolders: [String]
    @State private var userSetFolder: Bool
    @FocusState private var editorFocused: Bool

    @State private var saveTask: Task<Void, Never>?
    @State private var enrichTask: Task<Void, Never>?
    @State private var persistChain: Task<Item?, Never>?
    @State private var isFlushing = false

    private let api = DominoAPI()
    var onChanged: ((Item) -> Void)?
    var onDeleted: (() -> Void)?

    @State private var showDeleteConfirm = false

    private var isLinkCapture: Bool { itemKind == .link || itemKind == .pdf || looksLikeURL(text) }
    private var isNoteMode: Bool { !isLinkCapture }

    init(
        item: Item? = nil,
        folders: [String] = [],
        onChanged: ((Item) -> Void)? = nil,
        onDeleted: (() -> Void)? = nil
    ) {
        _itemId = State(initialValue: item?.id)
        _itemKind = State(initialValue: item?.inputType)
        _text = State(initialValue: item?.rawInput ?? "")
        let initialFolder = item?.topic ?? "Inbox"
        _folder = State(initialValue: initialFolder)
        _keyIdeas = State(initialValue: item?.keyIdeas ?? [])
        _starred = State(initialValue: item?.isFavorited ?? false)
        _pinned = State(initialValue: item?.isPinned ?? false)
        _availableFolders = State(initialValue: folders)
        let defaultish = ["inbox", "general"]
        _userSetFolder = State(initialValue: item != nil && !defaultish.contains(initialFolder.lowercased()))
        self.onChanged = onChanged
        self.onDeleted = onDeleted
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isNoteMode || itemKind == .link || itemKind == .pdf {
                    toolbarRow
                    Divider().overlay(DominoColors.hairline)
                } else if looksLikeURL(text) {
                    HStack(spacing: 8) {
                        Image(systemName: "link")
                            .foregroundStyle(DominoColors.accent)
                        Text("link — we'll grab the title and summary")
                            .font(.dominoBody(13))
                            .foregroundStyle(DominoColors.ink3)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    Divider().overlay(DominoColors.hairline)
                }

                ZStack(alignment: .topLeading) {
                    if text.isEmpty {
                        Text("start typing… or paste a link")
                            .font(.dominoBody(17))
                            .foregroundStyle(DominoColors.ink4)
                            .padding(.horizontal, 17)
                            .padding(.top, 16)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $text)
                        .font(.dominoBody(17))
                        .scrollContentBackground(.hidden)
                        .padding(.horizontal, 12)
                        .padding(.top, 8)
                        .focused($editorFocused)
                        .disabled(itemKind == .link || itemKind == .pdf)
                        .onChange(of: text) { _, _ in
                            scheduleSave()
                        }
                }

                if !keyIdeas.isEmpty {
                    keyIdeasBar
                }
            }
            .background(DominoColors.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    DominoCloseButton {
                        Task { await flushAndDismiss() }
                    }
                    .disabled(isFlushing)
                }
                ToolbarItem(placement: .principal) {
                    Text(status.label ?? (itemId == nil ? "new note" : "edited just now"))
                        .font(.dominoBody(13))
                        .foregroundStyle(DominoColors.ink3)
                        .textCase(.lowercase)
                }
                ToolbarItem(placement: .confirmationAction) {
                    HStack(spacing: 8) {
                        if itemId != nil, isNoteMode, onDeleted != nil {
                            DominoIconButton(
                                systemName: "trash",
                                accessibilityLabel: "delete",
                                tint: DominoColors.ink3
                            ) {
                                showDeleteConfirm = true
                            }
                        }
                        DominoIconButton(systemName: "checkmark", accessibilityLabel: "done") {
                            Task { await flushAndDismiss() }
                        }
                        .disabled(isFlushing)
                    }
                }
                ToolbarItemGroup(placement: .bottomBar) {
                    if isNoteMode {
                        editorToolButton(systemName: "checklist") { insertChecklist() }
                    }
                    editorToolButton(systemName: "folder") { showFolderPicker = true }
                    Spacer()
                    editorToolButton(systemName: starred ? "star.fill" : "star") {
                        Task { await toggleStar() }
                    }
                    .disabled(itemId == nil)
                    editorToolButton(systemName: pinned ? "pin.fill" : "pin") {
                        Task { await togglePin() }
                    }
                    .disabled(itemId == nil)
                }
            }
            .confirmationDialog("delete this note?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
                Button("delete", role: .destructive) {
                    Task { await deleteNote() }
                }
            }
            .sheet(isPresented: $showFolderPicker) {
                FolderPickerSheet(
                    folders: availableFolders,
                    selected: folder
                ) { chosen in
                    folder = chosen
                    userSetFolder = true
                    showFolderPicker = false
                    Task { await saveFolder() }
                }
            }
            .onAppear {
                editorFocused = true
            }
            .onDisappear {
                saveTask?.cancel()
                enrichTask?.cancel()
            }
        }
    }

    private var toolbarRow: some View {
        HStack(spacing: 10) {
            Button {
                showFolderPicker = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "folder")
                    Text(folder)
                        .lineLimit(1)
                }
                .font(.dominoBody(13, weight: .medium))
                .foregroundStyle(DominoColors.ink2)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(DominoColors.card(BookmarkMapper.hashColor(folder)))
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func editorToolButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(DominoColors.ink2)
                .frame(width: 40, height: 40)
                .background(DominoColors.chipIdle)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
    }

    private var keyIdeasBar: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("key ideas")
                .font(.caption.weight(.semibold))
                .foregroundStyle(DominoColors.ink3)
            ForEach(keyIdeas, id: \.self) { idea in
                Text("· \(idea)")
                    .font(.caption)
                    .foregroundStyle(DominoColors.ink2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(DominoColors.paper)
    }

    // MARK: - Actions

    private func insertChecklist() {
        if text.isEmpty || text.hasSuffix("\n") {
            text += NoteChecklist.uncheckedPrefix
        } else {
            text += "\n" + NoteChecklist.uncheckedPrefix
        }
        editorFocused = true
    }

    private func scheduleSave() {
        saveTask?.cancel()
        enrichTask?.cancel()
        // Already saved as a link — don't keep rewriting.
        if itemKind == .link || itemKind == .pdf { return }

        let snapshot = text
        let asURL = looksLikeURL(snapshot)
        saveTask = Task {
            // Links need a beat so paste finishes; notes stay snappy.
            let delay: UInt64 = asURL ? 600_000_000 : 400_000_000
            try? await Task.sleep(nanoseconds: delay)
            guard !Task.isCancelled else { return }
            let saved = await runPersist(snapshot)
            guard !Task.isCancelled else { return }
            if saved?.inputType == .note {
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                guard !Task.isCancelled else { return }
                await enrich()
            }
        }
    }

    /// Serialize saves so two creates never run concurrently (e.g. debounced save + dismiss).
    private func runPersist(_ snapshot: String) async -> Item? {
        let prior = persistChain
        let task = Task { @MainActor in
            if let prior {
                _ = await prior.value
            }
            return await performPersist(snapshot)
        }
        persistChain = task
        return await task.value
    }

    @MainActor
    @discardableResult
    private func performPersist(_ snapshot: String) async -> Item? {
        let trimmed = snapshot.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let token = auth.sessionToken else { return nil }

        let asURL = looksLikeURL(snapshot)
        status = asURL ? .grabbingLink : .saving
        do {
            let item: Item
            if let itemId, (itemKind == .note || itemKind == nil) {
                // Only patch body for notes. Links are immutable after create.
                guard !asURL else { return nil }
                item = try await api.patchItem(
                    token: token,
                    id: itemId,
                    patch: ItemPatch(rawInput: snapshot)
                )
            } else if itemId == nil {
                item = try await api.createItem(
                    token: token,
                    rawInput: snapshot,
                    topic: (!asURL && userSetFolder) ? folder : nil
                )
                self.itemId = item.id
                self.itemKind = item.inputType
                if let topic = item.topic { self.folder = topic }
                self.keyIdeas = item.keyIdeas
                DominoAnalytics.capture("item_created", properties: ["item_type": item.inputType.rawValue])
            } else {
                return nil
            }
            status = .saved
            onChanged?(item)
            return item
        } catch {
            status = .error(error.localizedDescription)
            return nil
        }
    }

    @MainActor
    private func flushAndDismiss() async {
        guard !isFlushing else { return }
        isFlushing = true
        defer { isFlushing = false }

        enrichTask?.cancel()
        enrichTask = nil

        // Let the debounced save finish — don't cancel it or we can double-create on dismiss.
        if let saveTask {
            await saveTask.value
        }
        saveTask = nil

        let snapshot = text
        if !snapshot.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           itemKind != .link, itemKind != .pdf {
            _ = await runPersist(snapshot)
        }
        dismiss()
    }

    private func looksLikeURL(_ raw: String) -> Bool {
        let t = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, !t.contains(where: \.isNewline) else { return false }
        let lower = t.lowercased()
        if lower.hasPrefix("http://") || lower.hasPrefix("https://") { return true }
        // Bare domains like example.com/path — match backend-ish heuristics lightly
        if lower.hasPrefix("www.") { return true }
        return false
    }

    private func saveFolder() async {
        guard let token = auth.sessionToken, let itemId else {
            // Will apply on first create
            return
        }
        await MainActor.run { status = .saving }
        do {
            let item = try await api.patchItem(
                token: token,
                id: itemId,
                patch: ItemPatch(topic: folder)
            )
            await MainActor.run {
                status = .saved
                onChanged?(item)
            }
        } catch {
            await MainActor.run { status = .error(error.localizedDescription) }
        }
    }

    private func enrich() async {
        guard let token = auth.sessionToken, let itemId else { return }
        guard itemKind == .note || itemKind == nil else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !looksLikeURL(trimmed) else { return }

        await MainActor.run { status = .polishing }
        do {
            let item = try await api.enrichItem(token: token, id: itemId)
            await MainActor.run {
                itemKind = item.inputType
                if !userSetFolder, let topic = item.topic {
                    folder = topic
                }
                keyIdeas = item.keyIdeas
                status = .saved
                onChanged?(item)
            }
        } catch {
            await MainActor.run { status = .saved }
        }
    }

    private func toggleStar() async {
        guard let token = auth.sessionToken, let itemId else { return }
        let next = !starred
        starred = next
        if let item = try? await api.patchItem(token: token, id: itemId, patch: ItemPatch(isFavorited: next)) {
            onChanged?(item)
        }
    }

    private func togglePin() async {
        guard let token = auth.sessionToken, let itemId else { return }
        let next = !pinned
        pinned = next
        if let item = try? await api.patchItem(token: token, id: itemId, patch: ItemPatch(isPinned: next)) {
            onChanged?(item)
        }
    }

    private func deleteNote() async {
        guard let token = auth.sessionToken, let itemId else { return }
        do {
            try await api.deleteItem(token: token, id: itemId)
            onDeleted?()
            dismiss()
        } catch {
            await MainActor.run { status = .error(error.localizedDescription) }
        }
    }
}

struct FolderPickerSheet: View {
    let folders: [String]
    let selected: String
    let onSelect: (String) -> Void

    @State private var newFolder = ""
    @Environment(\.dismiss) private var dismiss

    private var options: [String] {
        var set = Set(folders.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
        set.insert("Inbox")
        if !selected.isEmpty { set.insert(selected) }
        return set.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("folders") {
                    ForEach(options, id: \.self) { name in
                        Button {
                            onSelect(name)
                        } label: {
                            HStack {
                                Text(name)
                                    .foregroundStyle(DominoColors.ink)
                                Spacer()
                                if name == selected {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(DominoColors.accent)
                                }
                            }
                        }
                    }
                }
                Section("new folder") {
                    HStack {
                        TextField("name", text: $newFolder)
                        Button("add") {
                            let name = newFolder.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !name.isEmpty else { return }
                            onSelect(name)
                        }
                        .disabled(newFolder.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            .navigationTitle("folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    DominoCloseButton { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

#Preview {
    NoteEditorView()
        .environment(AuthSession())
}
