import Foundation

struct ChatSource: Codable, Identifiable, Hashable {
    let id: String
    let summary: String
    let rawInput: String
    let inputType: String
    let topic: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, summary, topic
        case rawInput = "raw_input"
        case inputType = "input_type"
        case createdAt = "created_at"
    }

    init(
        id: String,
        summary: String,
        rawInput: String = "",
        inputType: String = "note",
        topic: String? = nil,
        createdAt: String? = nil
    ) {
        self.id = id
        self.summary = summary
        self.rawInput = rawInput
        self.inputType = inputType
        self.topic = topic
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        summary = try container.decodeIfPresent(String.self, forKey: .summary) ?? ""
        rawInput = try container.decodeIfPresent(String.self, forKey: .rawInput) ?? ""
        inputType = try container.decodeIfPresent(String.self, forKey: .inputType) ?? "note"
        topic = try container.decodeIfPresent(String.self, forKey: .topic)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
    }

    var isLink: Bool {
        (inputType == "link" || inputType == "pdf") && rawInput.lowercased().hasPrefix("http")
    }

    var displayLabel: String {
        let label = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        if !label.isEmpty { return String(label.prefix(80)) }
        return String(rawInput.prefix(80))
    }
}

struct ChatResponse: Codable {
    let answer: String
    let sources: [ChatSource]

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        answer = try container.decode(String.self, forKey: .answer)
        sources = try container.decodeIfPresent([ChatSource].self, forKey: .sources) ?? []
    }

    enum CodingKeys: String, CodingKey {
        case answer, sources
    }
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
