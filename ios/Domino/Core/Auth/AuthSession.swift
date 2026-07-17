import Foundation
import Observation

@Observable
@MainActor
final class AuthSession {
    private(set) var sessionToken: String?
    private(set) var phone: String?
    private(set) var hasPassword: Bool?
    private(set) var profile: UserProfile?
    private(set) var isLoading = true
    /// When true, stay on login so the user can optionally set a password.
    private(set) var pendingPasswordSetup = false

    var isAuthenticated: Bool { sessionToken != nil && phone != nil }

    /// Ready for the main app (authenticated and not mid password setup).
    var showMainApp: Bool { isAuthenticated && !pendingPasswordSetup }

    private let api: DominoAPI

    init(api: DominoAPI = DominoAPI()) {
        self.api = api
    }

    func bootstrap() async {
        defer { isLoading = false }
        guard let token = KeychainStore.load(account: AppConfig.sessionAccount),
              let storedPhone = KeychainStore.load(account: AppConfig.phoneAccount) else {
            return
        }
        do {
            let me = try await api.getMe(token: token)
            apply(profile: me, token: token)
        } catch {
            KeychainStore.clearAll()
            clearSession()
            _ = storedPhone
        }
    }

    func loginWithToken(_ token: String) async throws {
        let me = try await api.getMe(token: token)
        try persist(token: token, phone: me.phone)
        apply(profile: me, token: token)
    }

    func completeLogin(tokens: AuthTokens, promptPasswordSetup: Bool = false) async throws {
        try persist(token: tokens.accessToken, phone: tokens.phone)
        sessionToken = tokens.accessToken
        phone = tokens.phone
        hasPassword = tokens.hasPassword
        pendingPasswordSetup = promptPasswordSetup && !tokens.hasPassword
        await refreshProfile()
    }

    func finishPasswordSetup() {
        pendingPasswordSetup = false
    }

    func refreshProfile() async {
        guard let token = sessionToken else { return }
        if let me = try? await api.getMe(token: token) {
            apply(profile: me, token: token)
        }
    }

    func updateProfile(_ patch: ProfileUpdate) async throws -> UserProfile {
        guard let token = sessionToken else { throw APIError(message: "not signed in") }
        let me = try await api.updateMe(token: token, patch: patch)
        apply(profile: me, token: token)
        return me
    }

    func setPassword(password: String, confirm: String) async throws {
        guard let token = sessionToken else { throw APIError(message: "not signed in") }
        _ = try await api.setPassword(token: token, password: password, confirm: confirm)
        hasPassword = true
        await refreshProfile()
    }

    func logout() async {
        if let sessionToken {
            try? await api.logout(token: sessionToken)
        }
        KeychainStore.clearAll()
        clearSession()
    }

    private func apply(profile: UserProfile, token: String) {
        self.profile = profile
        sessionToken = token
        phone = profile.phone
        hasPassword = profile.hasPassword ?? false
    }

    private func clearSession() {
        sessionToken = nil
        phone = nil
        hasPassword = nil
        profile = nil
        pendingPasswordSetup = false
    }

    private func persist(token: String, phone: String) throws {
        try KeychainStore.save(token, account: AppConfig.sessionAccount)
        try KeychainStore.save(phone, account: AppConfig.phoneAccount)
    }
}
