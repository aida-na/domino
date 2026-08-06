import Foundation

struct UserProfile: Codable, Equatable {
    let phone: String
    let email: String?
    let timezone: String
    let digestTime: String
    let digestOptedOut: Bool?
    let hasPassword: Bool?
    let inviteCode: String?
    let inviteURL: String?
    let discoverOptIn: Bool?
    let displayName: String?

    enum CodingKeys: String, CodingKey {
        case phone, email, timezone
        case digestTime = "digest_time"
        case digestOptedOut = "digest_opted_out"
        case hasPassword = "has_password"
        case inviteCode = "invite_code"
        case inviteURL = "invite_url"
        case discoverOptIn = "discover_opt_in"
        case displayName = "display_name"
    }
}

struct ProfileUpdate: Encodable {
    var email: String?
    var timezone: String?
    var digestTime: String?
    var digestOptedOut: Bool?
    var discoverOptIn: Bool?
    var displayName: String?

    enum CodingKeys: String, CodingKey {
        case email, timezone
        case digestTime = "digest_time"
        case digestOptedOut = "digest_opted_out"
        case discoverOptIn = "discover_opt_in"
        case displayName = "display_name"
    }
}
