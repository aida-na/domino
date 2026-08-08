import SwiftUI

private let profileTimezones = [
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "UTC",
]

private let profileTasteThreshold = 5

struct ProfileView: View {
    @Environment(AuthSession.self) private var auth
    @Environment(AppNavigation.self) private var nav
    @State private var items: [Item] = []
    @State private var isSigningOut = false
    @State private var showEdit = false
    @State private var showInvite = false
    @State private var showFriends = false
    @State private var showExport = false
    @State private var showDeleteAccount = false

    private let api = DominoAPI()

    private var starredCount: Int { items.filter(\.isFavorited).count }
    private var topicCount: Int { Set(items.flatMap(\.resolvedTopics)).count }
    private var thisWeekCount: Int {
        items.map(BookmarkMapper.toBookmark).filter { $0.days <= 7 }.count
    }
    private var savesToTaste: Int { max(0, profileTasteThreshold - items.count) }

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    DominoPageTitle(title: "profile")
                        .padding(.bottom, 26)

                    profileHeader
                        .padding(.bottom, 28)

                    statsRow
                        .padding(.bottom, savesToTaste > 0 ? 14 : 26)

                    if savesToTaste > 0 {
                        tasteNudge
                            .padding(.bottom, 26)
                    }

                    settingsList
                        .padding(.bottom, 26)

                    footer
                }
                .padding(.horizontal, 22)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .background(DominoColors.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    DominoCloseButton { dismiss() }
                }
            }
            .task {
                await load()
                await auth.refreshProfile()
            }
            .refreshable {
                await load()
                await auth.refreshProfile()
            }
            .sheet(isPresented: $showEdit) {
                EditProfileSheet()
            }
            .sheet(isPresented: $showInvite) {
                InviteShareSheet(inviteURL: auth.profile?.inviteURL)
            }
            .sheet(isPresented: $showFriends) {
                FriendsSheet()
            }
            .sheet(isPresented: $showExport) {
                ExportSavesSheet(token: auth.sessionToken)
            }
            .sheet(isPresented: $showDeleteAccount) {
                DeleteAccountSheet()
            }
        }
    }

    private var profileHeader: some View {
        HStack(spacing: 14) {
            Text(String(auth.phone?.suffix(1) ?? "?"))
                .font(.dominoDisplay(26, weight: .bold))
                .foregroundStyle(DominoColors.accentDeep)
                .frame(width: 56, height: 56)
                .background(DominoColors.card("o"))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(auth.profile?.displayName?.isEmpty == false
                     ? (auth.profile?.displayName ?? "")
                     : (auth.phone ?? "you"))
                    .font(.dominoBody(17, weight: .semibold))
                    .foregroundStyle(DominoColors.ink)
                Text(auth.profile?.email?.isEmpty == false ? (auth.profile?.email ?? "") : "add email for digest")
                    .font(.dominoBody(14))
                    .foregroundStyle(DominoColors.ink3)
                    .lineLimit(1)
                if let joined = auth.profile?.friendsJoinedCount, joined > 0 {
                    Text("\(joined) joined via your invite")
                        .font(.dominoBody(12))
                        .foregroundStyle(DominoColors.ink4)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var statsRow: some View {
        HStack(spacing: 0) {
            statCell("saved", value: items.count) {
                dismiss()
                nav.selectedTab = 0
            }
            statDivider
            statCell("on the map", value: topicCount) {
                dismiss()
                nav.selectedTab = 1
            }
            statDivider
            statCell("starred", value: starredCount) {
                dismiss()
                nav.pendingDashboardSort = .starred
                nav.selectedTab = 0
            }
            statDivider
            statCell("this week", value: thisWeekCount, action: nil)
        }
        .padding(.vertical, 24)
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(DominoColors.hairline)
            .frame(width: 1, height: 36)
    }

    @ViewBuilder
    private func statCell(_ label: String, value: Int, action: (() -> Void)?) -> some View {
        let content = VStack(spacing: 5) {
            Text("\(value)")
                .font(.dominoBody(26, weight: .bold))
                .foregroundStyle(value == 0 ? DominoColors.ink4 : DominoColors.ink)
            Text(label)
                .font(.dominoBody(12))
                .foregroundStyle(DominoColors.ink3)
        }
        .frame(maxWidth: .infinity)

        if let action {
            Button(action: action) { content.contentShape(Rectangle()) }
                .buttonStyle(.plain)
        } else {
            content
        }
    }

    private var tasteNudge: some View {
        HStack(spacing: 12) {
            DominoProgressDots(filled: items.count, total: profileTasteThreshold)
            Text("\(savesToTaste) more \(savesToTaste == 1 ? "save" : "saves") and domino can start matching your taste.")
                .font(.dominoBody(13))
                .foregroundStyle(DominoColors.accentDeep)
                .lineSpacing(2)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(DominoColors.card("o"))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var settingsList: some View {
        VStack(spacing: 0) {
            DominoSettingsRow(systemImage: "pencil", title: "edit profile") { showEdit = true }
            settingsDivider
            DominoSettingsRow(systemImage: "bookmark", title: "my folders", detail: "\(topicCount)") {
                dismiss()
                nav.selectedTab = 1
            }
            settingsDivider
            DominoSettingsRow(systemImage: "star", title: "starred", detail: "\(starredCount)") {
                dismiss()
                nav.pendingDashboardSort = .starred
                nav.selectedTab = 0
            }
            settingsDivider
            DominoSettingsRow(systemImage: "person.2", title: "friends") { showFriends = true }
            settingsDivider
            DominoSettingsRow(systemImage: "person.badge.plus", title: "invite a friend") { showInvite = true }
            settingsDivider
            DominoSettingsRow(systemImage: "square.and.arrow.up", title: "export everything") { showExport = true }
        }
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
    }

    private var settingsDivider: some View {
        Rectangle()
            .fill(DominoColors.hairline.opacity(0.6))
            .frame(height: 1)
            .padding(.leading, 18)
    }

    private var footer: some View {
        VStack(spacing: 18) {
            Button {
                Task {
                    isSigningOut = true
                    await auth.logout()
                    isSigningOut = false
                }
            } label: {
                Group {
                    if isSigningOut {
                        ProgressView()
                    } else {
                        Text("sign out")
                            .font(.dominoBody(16, weight: .semibold))
                            .foregroundStyle(DominoColors.ink2)
                    }
                }
            }
            .buttonStyle(.plain)

            Button {
                showDeleteAccount = true
            } label: {
                Text("delete account")
                    .font(.dominoBody(14))
                    .foregroundStyle(DominoColors.ink4)
            }
            .buttonStyle(.plain)

            Text("domino · made with care")
                .font(.dominoDisplay(15, weight: .regular))
                .foregroundStyle(DominoColors.ink4)
        }
        .frame(maxWidth: .infinity)
    }

    private func load() async {
        guard let token = auth.sessionToken else { return }
        items = (try? await api.getItems(token: token, limit: 500)) ?? []
    }
}

struct EditProfileSheet: View {
    @Environment(AuthSession.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var displayName = ""
    @State private var timezone = "America/Los_Angeles"
    @State private var digestTime = "08:00"
    @State private var discoverOptIn = false
    @State private var password = ""
    @State private var passwordConfirm = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var notice: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("phone") {
                        Text(auth.phone ?? "")
                            .foregroundStyle(DominoColors.ink3)
                    }
                    TextField("display name (for friends)", text: $displayName)
                    TextField("email (weekly digest)", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    Picker("timezone", selection: $timezone) {
                        ForEach(profileTimezones, id: \.self) { Text($0).tag($0) }
                    }
                    DatePicker(
                        "digest time",
                        selection: Binding(
                            get: { dateFromHHMM(digestTime) },
                            set: { digestTime = hhmm(from: $0) }
                        ),
                        displayedComponents: .hourAndMinute
                    )
                }

                Section("discover") {
                    Toggle("share saves anonymously", isOn: $discoverOptIn)
                    Text("Only link URLs and titles — never notes or who saved what.")
                        .font(.footnote)
                        .foregroundStyle(DominoColors.ink3)
                }

                Section(auth.hasPassword == true ? "change password" : "set password") {
                    SecureField("password (min 8)", text: $password)
                    SecureField("confirm password", text: $passwordConfirm)
                }

                if let notice {
                    Section { Text(notice).foregroundStyle(DominoColors.ink2) }
                }
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle("edit profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    DominoCloseButton { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    DominoIconButton(
                        systemName: "checkmark",
                        accessibilityLabel: isSaving ? "saving" : "save"
                    ) {
                        Task { await save() }
                    }
                    .disabled(isSaving)
                }
            }
            .onAppear {
                email = auth.profile?.email ?? ""
                displayName = auth.profile?.displayName ?? ""
                timezone = auth.profile?.timezone ?? TimeZone.current.identifier
                digestTime = String((auth.profile?.digestTime ?? "08:00").prefix(5))
                discoverOptIn = auth.profile?.discoverOptIn ?? false
            }
        }
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        notice = nil
        defer { isSaving = false }
        do {
            _ = try await auth.updateProfile(ProfileUpdate(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ? nil
                    : email.trimmingCharacters(in: .whitespacesAndNewlines),
                timezone: timezone,
                digestTime: digestTime,
                discoverOptIn: discoverOptIn,
                displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ? nil
                    : displayName.trimmingCharacters(in: .whitespacesAndNewlines)
            ))
            if !password.isEmpty {
                guard password.count >= 8 else { throw APIError(message: "password must be at least 8 characters") }
                guard password == passwordConfirm else { throw APIError(message: "passwords do not match") }
                try await auth.setPassword(password: password, confirm: passwordConfirm)
                password = ""
                passwordConfirm = ""
            }
            notice = "saved"
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func dateFromHHMM(_ value: String) -> Date {
        let parts = value.split(separator: ":")
        var comps = DateComponents()
        comps.hour = Int(parts.first ?? "8") ?? 8
        comps.minute = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
        return Calendar.current.date(from: comps) ?? Date()
    }

    private func hhmm(from date: Date) -> String {
        let comps = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", comps.hour ?? 8, comps.minute ?? 0)
    }
}

struct InviteShareSheet: View {
    @Environment(\.dismiss) private var dismiss
    let inviteURL: String?
    @State private var notice: String?

    private var shareText: String {
        let url = inviteURL ?? "https://domino.fyi/login"
        return "i use domino to save links over iMessage. join with my link and we'll connect automatically:\n\(url)"
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                if let inviteURL {
                    Text(inviteURL)
                        .font(.footnote)
                        .foregroundStyle(DominoColors.ink2)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(DominoColors.bg)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                ShareLink(item: shareText) {
                    labelButton("share invite", systemImage: "square.and.arrow.up", filled: true)
                }

                Button {
                    UIPasteboard.general.string = "join me on domino — save links over iMessage. we'll connect automatically:\n\(inviteURL ?? "https://domino.fyi/login")"
                    notice = "invite copied"
                } label: {
                    labelButton("copy invite", systemImage: "doc.on.doc", filled: false)
                }
                .buttonStyle(.plain)

                if let notice {
                    Text(notice)
                        .font(.caption)
                        .foregroundStyle(DominoColors.ink3)
                }

                Spacer()
            }
            .padding()
            .navigationTitle("invite")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    DominoCloseButton { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func labelButton(_ title: String, systemImage: String, filled: Bool) -> some View {
        Label(title, systemImage: systemImage)
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(filled ? DominoColors.accent : DominoColors.paper)
            .foregroundStyle(filled ? Color.white : DominoColors.ink)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(filled ? Color.clear : DominoColors.hairline)
            )
    }
}

struct ExportSavesSheet: View {
    @Environment(\.dismiss) private var dismiss
    let token: String?
    @State private var notice: String?
    @State private var isExporting = false

    private let api = DominoAPI()

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("download a json export of your profile and all saves.")
                    .font(.subheadline)
                    .foregroundStyle(DominoColors.ink3)

                Button {
                    Task { await exportJSON() }
                } label: {
                    Group {
                        if isExporting {
                            ProgressView().tint(.white)
                        } else {
                            Label("download json", systemImage: "square.and.arrow.down")
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(DominoColors.accent)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .disabled(isExporting || token == nil)

                if let notice {
                    Text(notice)
                        .font(.caption)
                        .foregroundStyle(DominoColors.ink3)
                }

                Spacer()
            }
            .padding()
            .navigationTitle("export")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    DominoCloseButton { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func exportJSON() async {
        guard let token else {
            notice = "not signed in"
            return
        }
        isExporting = true
        defer { isExporting = false }
        do {
            let data = try await api.exportAccount(token: token)
            let name = "domino-export-\(ISO8601DateFormatter().string(from: Date()).prefix(10)).json"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(String(name))
            try data.write(to: url, options: .atomic)
            let av = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else {
                notice = "couldn't present share sheet"
                return
            }
            let presenter = scene.windows.first(where: \.isKeyWindow)?.rootViewController
                ?? scene.windows.first?.rootViewController
            presenter?.present(av, animated: true)
            notice = "export ready"
            DominoAnalytics.capture("account_export_completed")
        } catch {
            notice = "couldn't export"
        }
    }
}

struct DeleteAccountSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var auth
    @State private var confirmText = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isDeleting = false

    private let api = DominoAPI()

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("this permanently deletes your account and all saves. this cannot be undone.")
                    .font(.subheadline)
                    .foregroundStyle(DominoColors.ink3)

                TextField("type delete to confirm", text: $confirmText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(DominoColors.paper)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(DominoColors.hairline))

                if auth.profile?.hasPassword == true {
                    SecureField("password", text: $password)
                        .padding(12)
                        .background(DominoColors.paper)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(DominoColors.hairline))
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                Button(role: .destructive) {
                    Task { await deleteAccount() }
                } label: {
                    Group {
                        if isDeleting {
                            ProgressView()
                        } else {
                            Text("delete my account").fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.plain)
                .background(Color.red.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .disabled(isDeleting || confirmText.lowercased() != "delete")

                Spacer()
            }
            .padding()
            .navigationTitle("delete account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    DominoCloseButton { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func deleteAccount() async {
        guard confirmText.lowercased() == "delete", let token = auth.sessionToken else { return }
        isDeleting = true
        errorMessage = nil
        defer { isDeleting = false }
        do {
            _ = try await api.deleteAccount(
                token: token,
                password: auth.profile?.hasPassword == true ? password : nil
            )
            DominoAnalytics.capture("account_deleted")
            await auth.logout()
            dismiss()
        } catch let apiError as APIError {
            errorMessage = apiError.message
        } catch {
            errorMessage = "couldn't delete account"
        }
    }
}

struct FriendsSheet: View {
    @Environment(AuthSession.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var friends: [DominoFriend] = []
    @State private var pending: FriendsPendingResponse?
    @State private var inviteCode = ""
    @State private var phone = ""
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showManualAdd = false

    private let api = DominoAPI()

    @State private var didCopy = false

    private var inviteShareText: String {
        let url = auth.profile?.inviteURL ?? "https://domino.fyi/login"
        return "i use domino to save links over iMessage. join with my link and we'll connect automatically:\n\(url)"
    }

    private var inviteLabel: String {
        let url = auth.profile?.inviteURL ?? "https://domino.fyi/login"
        return url
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    DominoPageTitle(title: "friends", size: 34)
                        .padding(.bottom, 26)

                    inviteBlock
                        .padding(.bottom, 28)

                    if let pending, !pending.incoming.isEmpty {
                        sectionLabel("\(pending.incoming.count) waiting for you")
                        ForEach(pending.incoming) { req in
                            personRow(
                                icon: "person.2",
                                name: req.user.displayName,
                                detail: "wants to connect"
                            ) {
                                HStack(spacing: 6) {
                                    pillButton("accept", filled: true) { Task { await accept(req.requestId) } }
                                    pillButton("decline") { Task { await decline(req.requestId) } }
                                }
                            }
                        }
                        Spacer().frame(height: 14)
                    }

                    if !friends.isEmpty {
                        sectionLabel("your friends · \(friends.count)")
                        ForEach(friends) { friend in
                            personRow(
                                icon: "person.crop.circle",
                                name: friend.displayName,
                                detail: nil
                            ) {
                                pillButton("remove", tint: Color.red.opacity(0.85)) {
                                    Task { await remove(friend.friendshipId) }
                                }
                            }
                        }
                        Spacer().frame(height: 14)
                    }

                    if let pending, !pending.outgoing.isEmpty {
                        sectionLabel("waiting on \(pending.outgoing.count)")
                        ForEach(pending.outgoing) { req in
                            personRow(
                                icon: "clock",
                                name: req.user.displayName,
                                detail: FriendsSheet.invitedAgo(req.createdAt)
                            ) {
                                pillButton("cancel") { Task { await decline(req.requestId) } }
                            }
                        }
                        Spacer().frame(height: 14)
                    }

                    if friends.isEmpty && !isLoading {
                        VStack(spacing: 12) {
                            DominoProgressDots(filled: 0, total: 3, size: 9)
                            Text("no friends yet. the first one changes what discover can show you.")
                                .font(.dominoBody(16))
                                .foregroundStyle(DominoColors.ink3)
                                .multilineTextAlignment(.center)
                                .lineSpacing(3)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 28)
                    }

                    manualAddSection

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.dominoBody(14))
                            .foregroundStyle(.red)
                            .padding(.top, 14)
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .background(DominoColors.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    DominoCloseButton { dismiss() }
                }
            }
            .task { await reload() }
            .refreshable { await reload() }
        }
    }

    // MARK: - Invite block

    private var inviteBlock: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("share your link, connect automatically.")
                .font(.dominoDisplay(24, weight: .bold))
                .foregroundStyle(DominoColors.accentDeep)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)

            Button {
                UIPasteboard.general.string = auth.profile?.inviteURL ?? "https://domino.fyi/login"
                didCopy = true
                Task {
                    try? await Task.sleep(for: .seconds(1.8))
                    didCopy = false
                }
            } label: {
                HStack(spacing: 10) {
                    Text(didCopy ? "copied to clipboard" : inviteLabel)
                        .font(.dominoBody(14, weight: .semibold))
                        .foregroundStyle(DominoColors.ink)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer(minLength: 0)
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(DominoColors.ink3)
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .background(DominoColors.paper)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)

            ShareLink(item: inviteShareText) {
                Text("share invite link")
                    .font(.dominoBody(16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(DominoColors.accent)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DominoColors.card("o"))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    // MARK: - Manual add

    private var manualAddSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.easeOut(duration: 0.18)) { showManualAdd.toggle() }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 16))
                        .foregroundStyle(DominoColors.ink)
                    Text("add by code or phone")
                        .font(.dominoBody(16))
                        .foregroundStyle(DominoColors.ink)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(DominoColors.ink4)
                        .rotationEffect(.degrees(showManualAdd ? 90 : 0))
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity)
                .background(DominoColors.paper)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(DominoColors.hairline, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            if showManualAdd {
                VStack(spacing: 10) {
                    HStack(spacing: 8) {
                        TextField("invite code", text: $inviteCode)
                            .font(.dominoBody(15))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(DominoColors.paper)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(DominoColors.hairline))
                        pillButton("add", filled: true) { Task { await sendRequest(useInvite: true) } }
                    }
                    HStack(spacing: 8) {
                        TextField("phone", text: $phone)
                            .font(.dominoBody(15))
                            .keyboardType(.phonePad)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(DominoColors.paper)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(DominoColors.hairline))
                        pillButton("add", filled: true) { Task { await sendRequest(useInvite: false) } }
                    }
                }
            }
        }
    }

    // MARK: - Row building blocks

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.dominoBody(12, weight: .semibold))
            .tracking(0.9)
            .foregroundStyle(DominoColors.ink4)
            .padding(.bottom, 12)
    }

    private func personRow<Action: View>(
        icon: String,
        name: String,
        detail: String?,
        @ViewBuilder action: () -> Action
    ) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(DominoColors.ink4)
                .frame(width: 40, height: 40)
                .background(DominoColors.chipIdle)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.dominoBody(16, weight: .semibold))
                    .foregroundStyle(DominoColors.ink)
                    .lineLimit(1)
                if let detail {
                    Text(detail)
                        .font(.dominoBody(13))
                        .foregroundStyle(DominoColors.ink3)
                }
            }

            Spacer(minLength: 0)
            action()
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.03), radius: 6, y: 1)
        .padding(.bottom, 8)
    }

    private func pillButton(
        _ title: String,
        filled: Bool = false,
        tint: Color = DominoColors.ink3,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.dominoBody(14, weight: filled ? .semibold : .regular))
                .foregroundStyle(filled ? DominoColors.bg : tint)
                .padding(.horizontal, 15)
                .padding(.vertical, 8)
                .background(filled ? DominoColors.ink : Color.clear)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(filled ? Color.clear : DominoColors.hairline, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private static func invitedAgo(_ iso: String?) -> String {
        guard let iso else { return "invited" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return "invited" }
        let days = max(0, Calendar.current.dateComponents([.day], from: date, to: Date()).day ?? 0)
        switch days {
        case 0: return "invited today"
        case 1: return "invited yesterday"
        default: return "invited \(days) days ago"
        }
    }

    private func reload() async {
        guard let token = auth.sessionToken else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            async let f = api.getFriends(token: token)
            async let p = api.getFriendsPending(token: token)
            friends = try await f.friends
            pending = try await p
        } catch let apiError as APIError {
            errorMessage = apiError.message
        } catch {
            errorMessage = "couldn't load friends"
        }
    }

    private func sendRequest(useInvite: Bool) async {
        guard let token = auth.sessionToken else { return }
        errorMessage = nil
        do {
            let body = FriendRequestBody(
                phone: useInvite ? nil : PhoneNormalizer.normalize(phone),
                inviteCode: useInvite ? inviteCode : nil
            )
            _ = try await api.sendFriendRequest(token: token, body: body)
            inviteCode = ""
            phone = ""
            await reload()
        } catch let apiError as APIError {
            errorMessage = apiError.message
        } catch {
            errorMessage = "request failed"
        }
    }

    private func accept(_ id: String) async {
        guard let token = auth.sessionToken else { return }
        try? await api.acceptFriendRequest(token: token, requestId: id)
        await reload()
    }

    private func decline(_ id: String) async {
        guard let token = auth.sessionToken else { return }
        try? await api.declineFriendRequest(token: token, requestId: id)
        await reload()
    }

    private func remove(_ id: String) async {
        guard let token = auth.sessionToken else { return }
        try? await api.removeFriend(token: token, friendshipId: id)
        await reload()
    }
}

#Preview {
    ProfileView()
        .environment(AuthSession())
        .environment(AppNavigation())
}
