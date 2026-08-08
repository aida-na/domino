import XCTest
@testable import Domino

final class ChatModelsTests: XCTestCase {
    func testDecodesLegacyChatSourcePayload() throws {
        let json = """
        {
          "id": "abc12345-0000-0000-0000-000000000000",
          "summary": "Health article",
          "created_at": "2026-08-01T12:00:00Z"
        }
        """.data(using: .utf8)!

        let source = try JSONDecoder().decode(ChatSource.self, from: json)
        XCTAssertEqual(source.summary, "Health article")
        XCTAssertEqual(source.rawInput, "")
        XCTAssertEqual(source.inputType, "note")
    }

    func testDecodesFullChatResponse() throws {
        let json = """
        {
          "answer": "You saved health content [Item abc12345].",
          "sources": [
            {
              "id": "abc12345-0000-0000-0000-000000000000",
              "summary": "Health article",
              "raw_input": "https://example.com/health",
              "input_type": "link",
              "topic": "Health & Wellness",
              "created_at": "2026-08-01T12:00:00Z"
            }
          ]
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(ChatResponse.self, from: json)
        XCTAssertTrue(response.answer.contains("health content"))
        XCTAssertEqual(response.sources.count, 1)
        XCTAssertTrue(response.sources[0].isLink)
    }

    func testDecodesChatResponseWithoutSourcesKey() throws {
        let json = """
        {
          "answer": "You haven't saved anything yet."
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(ChatResponse.self, from: json)
        XCTAssertTrue(response.sources.isEmpty)
    }
}
