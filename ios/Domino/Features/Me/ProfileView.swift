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

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    DominoPageTitle(title: "profile")

                    profileHeader
                    actionButtons
                    statsGrid
                    signOutButton
                    deleteAccountButton
                    Text("domino · made with care")
                        .font(.dominoBody(12))
                        .foregroundStyle(DominoColors.ink4)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
                .padding(16)
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
        HStack(spacing: 16) {
            Text(String(auth.phone?.suffix(1) ?? "?"))
                .font(.title2.weight(.bold))
                .frame(width: 56, height: 56)
                .background(DominoColors.card("o"))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(auth.phone ?? "")
                    .font(.headline)
                Text(auth.profile?.email?.isEmpty == false ? (auth.profile?.email ?? "") : "add email for digest")
                    .font(.subheadline)
                    .foregroundStyle(DominoColors.ink3)
                if let joined = auth.profile?.friendsJoinedCount, joined > 0 {
                    Text("\(joined) joined via your invite")
                        .font(.caption)
                        .foregroundStyle(DominoColors.ink3)
                }
            }
            Spacer()
        }
        .padding()
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .onTapGesture { showEdit = true }
    }

    private var actionButtons: some View {
        HStack(spacing: 10) {
            Button { showEdit = true } label: {
                Label("edit", systemImage: "pencil")
            }
            .buttonStyle(SecondaryPillButtonStyle())

            Button { showFriends = true } label: {
                Label("friends", systemImage: "person.2")
            }
            .buttonStyle(SecondaryPillButtonStyle())

            Button { showInvite = true } label: {
                Label("invite", systemImage: "person.badge.plus")
            }
            .buttonStyle(SecondaryPillButtonStyle())

            Button { showExport = true } label: {
                Label("export", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(SecondaryPillButtonStyle())
        }
    }

    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            Button {
                dismiss()
                nav.selectedTab = 0
            } label: {
                statCard("saved", value: items.count)
            }
            .buttonStyle(.plain)

            Button {
                dismiss()
                nav.pendingDashboardSort = .starred
                nav.selectedTab = 0
            } label: {
                statCard("starred", value: starredCount)
            }
            .buttonStyle(.plain)

            Button {
                dismiss()
                nav.selectedTab = 1
            } label: {
                statCard("map", value: topicCount)
            }
            .buttonStyle(.plain)

            statCard("this week", value: thisWeekCount)
        }
    }

    private func statCard(_ label: String, value: Int) -> some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.title2.weight(.bold))
                .foregroundStyle(DominoColors.ink)
            Text(label)
                .font(.caption)
                .foregroundStyle(DominoColors.ink3)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var signOutButton: some View {
        Button(role: .destructive) {
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
                    Text("sign out").fontWeight(.semibold)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(DominoColors.hairline))
    }

    private var deleteAccountButton: some View {
        Button {
            showDeleteAccount = true
        } label: {
            Text("delete account")
                .fontWeight(.medium)
                .foregroundStyle(Color.red.opacity(0.85))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .buttonStyle(.plain)
    }

    private func load() async {
        guard let token = auth.sessionToken else { return }
        items = (try? await api.getItems(token: token, limit: 500)) ?? []
    }
}

private struct SecondaryPillButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(DominoColors.paper)
            .foregroundStyle(DominoColors.ink)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(DominoColors.hairline))
            .opacity(configuration.isPressed ? 0.7 : 1)
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

    private var inviteShareText: String {
        let url = auth.profile?.inviteURL ?? "https://domino.fyi/login"
        return "i use domino to save links over iMessage. join with my link and we'll connect automatically:\n\(url)"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Share your invite link — you'll auto-connect when they join.")
                        .font(.dominoBody(13))
                        .foregroundStyle(DominoColors.ink3)
                    ShareLink(item: inviteShareText) {
                        Text("share invite link")
                            .font(.dominoBody(15, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    }
                }

                if let pending, !pending.incoming.isEmpty {
                    Section("incoming requests") {
                        ForEach(pending.incoming) { req in
                            HStack {
                                Text(req.user.displayName)
                                Spacer()
                                Button("accept") { Task { await accept(req.requestId) } }
                                Button("decline") { Task { await decline(req.requestId) } }
                            }
                        }
                    }
                }

                Section("friends (\(friends.count))") {
                    if friends.isEmpty {
                        Text("No friends yet — share your invite link above.")
                            .foregroundStyle(DominoColors.ink3)
                    } else {
                        ForEach(friends) { friend in
                            HStack {
                                Text(friend.displayName)
                                Spacer()
                                Button("remove", role: .destructive) {
                                    Task { await remove(friend.friendshipId) }
                                }
                            }
                        }
                    }
                }

                if let pending, !pending.outgoing.isEmpty {
                    Section("pending") {
                        ForEach(pending.outgoing) { req in
                            HStack {
                                Text(req.user.displayName)
                                    .foregroundStyle(DominoColors.ink3)
                                Spacer()
                                Button("cancel") { Task { await decline(req.requestId) } }
                            }
                        }
                    }
                }

                Section {
                    Button(showManualAdd ? "hide manual add" : "already on domino? add by code or phone") {
                        showManualAdd.toggle()
                    }
                    .font(.dominoBody(13, weight: .semibold))
                    .foregroundStyle(DominoColors.ink3)
                    if showManualAdd {
                        HStack {
                            TextField("invite code", text: $inviteCode)
                                .textInputAutocapitalization(.never)
                            Button("add") { Task { await sendRequest(useInvite: true) } }
                        }
                        HStack {
                            TextField("phone", text: $phone)
                                .keyboardType(.phonePad)
                            Button("add") { Task { await sendRequest(useInvite: false) } }
                        }
                    }
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle("friends")
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
