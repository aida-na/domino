import XCTest
@testable import Domino

final class APIErrorTests: XCTestCase {
    func testStringDetail() throws {
        let data = try JSONSerialization.data(withJSONObject: [
            "detail": "Invalid or expired code",
        ])
        let error = APIError.fromResponse(data: data, statusCode: 401)
        XCTAssertEqual(error.message, "Invalid or expired code")
        XCTAssertNil(error.code)
    }

    func testSignupFullObjectDetail() throws {
        let data = try JSONSerialization.data(withJSONObject: [
            "detail": [
                "code": "signup_full",
                "message": "we're only letting in a few people a day — join the waitlist or try again tomorrow.",
            ],
        ])
        let error = APIError.fromResponse(data: data, statusCode: 403)
        XCTAssertEqual(error.code, "signup_full")
        XCTAssertTrue(error.message.contains("waitlist"))
    }

    func testValidationArrayDetail() throws {
        let data = try JSONSerialization.data(withJSONObject: [
            "detail": [
                ["type": "string_too_short", "msg": "String should have at least 8 characters"],
            ],
        ])
        let error = APIError.fromResponse(data: data, statusCode: 422)
        XCTAssertEqual(error.message, "String should have at least 8 characters")
    }

    func testFallbackWhenBodyInvalid() {
        let data = Data("not-json".utf8)
        let error = APIError.fromResponse(data: data, statusCode: 500)
        XCTAssertEqual(error.message, "Request failed (500)")
    }
}
