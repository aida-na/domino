import Foundation

struct DiscoverTrendItem: Codable, Identifiable, Hashable {
    var id: String { url }
    let url: String
    let title: String
    let saveCount: Int
    let topic: String?

    enum CodingKeys: String, CodingKey {
        case url, title, topic
        case saveCount = "save_count"
    }
}

struct DiscoverGlobalResponse: Codable {
    let items: [DiscoverTrendItem]
    let cohortLabel: String

    enum CodingKeys: String, CodingKey {
        case items
        case cohortLabel = "cohort_label"
    }
}

struct DiscoverSimilarResponse: Codable {
    let items: [DiscoverTrendItem]
    let cohortLabel: String
    let optInRequired: Bool?

    enum CodingKeys: String, CodingKey {
        case items
        case cohortLabel = "cohort_label"
        case optInRequired = "opt_in_required"
    }
}

struct DiscoverFriendsResponse: Codable {
    let items: [DiscoverTrendItem]
    let friendCount: Int
    let optInRequired: Bool?

    enum CodingKeys: String, CodingKey {
        case items
        case friendCount = "friend_count"
        case optInRequired = "opt_in_required"
    }
}

struct DiscoverStatusResponse: Codable {
    let optIn: Bool
    let tasteReady: Bool
    let itemCount: Int
    let friendCount: Int
    let hasData: Bool

    enum CodingKeys: String, CodingKey {
        case optIn = "opt_in"
        case tasteReady = "taste_ready"
        case itemCount = "item_count"
        case friendCount = "friend_count"
        case hasData = "has_data"
    }
}

struct DominoFriend: Codable, Identifiable {
    let id: String
    let displayName: String
    let friendshipId: String

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case friendshipId = "friendship_id"
    }
}

struct FriendsListResponse: Codable {
    let friends: [DominoFriend]
}

struct FriendRequestUser: Codable {
    let id: String
    let displayName: String

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
    }
}

struct FriendRequestItem: Codable, Identifiable {
    let requestId: String
    let user: FriendRequestUser
    let createdAt: String?

    var id: String { requestId }

    enum CodingKeys: String, CodingKey {
        case requestId = "request_id"
        case user
        case createdAt = "created_at"
    }
}

struct FriendsPendingResponse: Codable {
    let incoming: [FriendRequestItem]
    let outgoing: [FriendRequestItem]
}

struct FriendRequestBody: Encodable {
    var phone: String?
    var inviteCode: String?

    enum CodingKeys: String, CodingKey {
        case phone
        case inviteCode = "invite_code"
    }
}

struct FriendActionBody: Encodable {
    let requestId: String

    enum CodingKeys: String, CodingKey {
        case requestId = "request_id"
    }
}

struct FriendRequestResponse: Codable {
    let requestId: String
    let status: String
    let user: FriendRequestUser?

    enum CodingKeys: String, CodingKey {
        case requestId = "request_id"
        case status
        case user
    }
}
