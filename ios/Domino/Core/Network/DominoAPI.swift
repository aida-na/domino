import Foundation

struct DominoAPI {
    private let client = APIClient()

    // MARK: - Auth

    func getSignupStatus() async throws -> SignupStatus {
        try await client.request("GET", path: "auth/signup-status")
    }

    func requestOTP(phone: String) async throws -> OKResponse {
        try await client.request("POST", path: "auth/otp/request", body: PhoneRequest(phone: phone))
    }

    func verifyOTP(phone: String, code: String, ref: String? = nil) async throws -> AuthTokens {
        try await client.request(
            "POST",
            path: "auth/otp/verify",
            body: OTPVerifyRequest(phone: phone, code: code, ref: ref)
        )
    }

    func loginWithPassword(phone: String, password: String) async throws -> AuthTokens {
        try await client.request("POST", path: "auth/password/login", body: PasswordLoginRequest(phone: phone, password: password))
    }

    func setPassword(token: String, password: String, confirm: String) async throws -> OKResponse {
        try await client.request(
            "POST",
            path: "auth/password/set",
            token: token,
            body: SetPasswordRequest(password: password, passwordConfirm: confirm)
        )
    }

    func joinWaitlist(email: String, ref: String? = nil) async throws -> WaitlistResponse {
        try await client.request(
            "POST",
            path: "waitlist",
            body: WaitlistRequest(email: email, ref: ref)
        )
    }

    func getMe(token: String) async throws -> UserProfile {
        try await client.request("GET", path: "auth/me", token: token)
    }

    func updateMe(token: String, patch: ProfileUpdate) async throws -> UserProfile {
        try await client.request("PATCH", path: "auth/me", token: token, body: patch)
    }

    func logout(token: String) async throws {
        let _: LogoutResponse = try await client.request("POST", path: "auth/logout", token: token)
    }

    func exportAccount(token: String) async throws -> Data {
        try await client.requestData("GET", path: "auth/me/export", token: token)
    }

    func deleteAccount(token: String, password: String? = nil) async throws -> DeleteAccountResponse {
        try await client.request(
            "POST",
            path: "auth/me/delete",
            token: token,
            body: DeleteAccountRequest(confirm: "delete", password: password)
        )
    }

    // MARK: - Items

    func getItems(token: String, limit: Int = 100, offset: Int = 0) async throws -> [Item] {
        try await client.request(
            "GET",
            path: "items",
            token: token,
            query: ["limit": String(limit), "offset": String(offset)]
        )
    }

    func createItem(token: String, rawInput: String, topic: String? = nil) async throws -> Item {
        try await client.request(
            "POST",
            path: "items",
            token: token,
            body: CreateItemRequest(rawInput: rawInput, topic: topic)
        )
    }

    func patchItem(token: String, id: String, patch: ItemPatch) async throws -> Item {
        try await client.request("PATCH", path: "items/\(id)", token: token, body: patch)
    }

    func enrichItem(token: String, id: String) async throws -> Item {
        try await client.request("POST", path: "items/\(id)/enrich", token: token)
    }

    func deleteItem(token: String, id: String) async throws {
        try await client.requestVoid("DELETE", path: "items/\(id)", token: token)
    }

    // MARK: - Chat

    func chat(token: String, message: String) async throws -> ChatResponse {
        try await client.request("POST", path: "chat", token: token, body: ChatRequest(message: message))
    }

    // MARK: - Media

    func mediaProxyURL(for url: String, token: String) -> URL? {
        var components = URLComponents(url: AppConfig.apiBaseURL.appendingPathComponent("media-proxy"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "url", value: url),
            URLQueryItem(name: "token", value: token),
        ]
        return components?.url
    }
}
