import Foundation

enum InputType: String, Codable, CaseIterable {
    case link, pdf, image, note
}

struct Item: Codable, Identifiable, Hashable {
    let id: String
    let rawInput: String
    let inputType: InputType
    let extractedText: String?
    let summary: String?
    let topic: String?
    let keyIdeas: [String]
    let createdAt: String?
    let digestSent: Bool
    let isPinned: Bool
    let isFavorited: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case rawInput = "raw_input"
        case inputType = "input_type"
        case extractedText = "extracted_text"
        case summary, topic
        case keyIdeas = "key_ideas"
        case createdAt = "created_at"
        case digestSent = "digest_sent"
        case isPinned = "is_pinned"
        case isFavorited = "is_favorited"
    }
}

struct ItemPatch: Encodable {
    var isPinned: Bool?
    var isFavorited: Bool?
    var rawInput: String?
    var topic: String?
    var enrich: Bool?

    enum CodingKeys: String, CodingKey {
        case isPinned = "is_pinned"
        case isFavorited = "is_favorited"
        case rawInput = "raw_input"
        case topic
        case enrich
    }
}

struct CreateItemRequest: Encodable {
    let rawInput: String
    var topic: String? = nil

    enum CodingKeys: String, CodingKey {
        case rawInput = "raw_input"
        case topic
    }
}
