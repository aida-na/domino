import Foundation

struct ChatSource: Codable, Identifiable, Hashable {
    let id: String
    let summary: String
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, summary
        case createdAt = "created_at"
    }
}

struct ChatResponse: Codable {
    let answer: String
    let sources: [ChatSource]
}

struct ChatRequest: Encodable {
    let message: String
}

struct ChatMessage: Identifiable {
    enum Role { case user, assistant }

    let id = UUID()
    let role: Role
    let text: String
    let sources: [ChatSource]?
}
