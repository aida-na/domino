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

    enum CodingKeys: String, CodingKey {
        case phone, email, timezone
        case digestTime = "digest_time"
        case digestOptedOut = "digest_opted_out"
        case hasPassword = "has_password"
        case inviteCode = "invite_code"
        case inviteURL = "invite_url"
    }
}

struct ProfileUpdate: Encodable {
    var email: String?
    var timezone: String?
    var digestTime: String?
    var digestOptedOut: Bool?

    enum CodingKeys: String, CodingKey {
        case email, timezone
        case digestTime = "digest_time"
        case digestOptedOut = "digest_opted_out"
    }
}
