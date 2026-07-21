import Foundation

struct AuthTokens: Codable {
    let accessToken: String
    let tokenType: String
    let phone: String
    let hasPassword: Bool

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case phone
        case hasPassword = "has_password"
    }
}

struct OKResponse: Codable {
    let ok: Bool
}

struct LogoutResponse: Codable {
    let success: Bool
}

struct PhoneRequest: Encodable {
    let phone: String
}

struct OTPVerifyRequest: Encodable {
    let phone: String
    let code: String
    var ref: String? = nil
}

struct PasswordLoginRequest: Encodable {
    let phone: String
    let password: String
}

struct WaitlistRequest: Encodable {
    let email: String
    let ref: String?
}

struct WaitlistResponse: Codable {
    let ok: Bool
    let alreadyRegistered: Bool?

    enum CodingKeys: String, CodingKey {
        case ok
        case alreadyRegistered = "already_registered"
    }
}

struct SetPasswordRequest: Encodable {
    let password: String
    let passwordConfirm: String

    enum CodingKeys: String, CodingKey {
        case password
        case passwordConfirm = "password_confirm"
    }
}

struct DeleteAccountRequest: Encodable {
    let confirm: String
    var password: String? = nil
}

struct DeleteAccountResponse: Codable {
    let success: Bool
}
