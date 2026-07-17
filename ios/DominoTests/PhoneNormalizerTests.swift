import XCTest
@testable import Domino

final class PhoneNormalizerTests: XCTestCase {
    func testTenDigitUSNumber() {
        XCTAssertEqual(PhoneNormalizer.normalize("6505550100"), "+16505550100")
        XCTAssertEqual(PhoneNormalizer.normalize("(650) 555-0100"), "+16505550100")
    }

    func testElevenDigitWithLeadingOne() {
        XCTAssertEqual(PhoneNormalizer.normalize("16505550100"), "+16505550100")
    }

    func testAlreadyE164() {
        XCTAssertEqual(PhoneNormalizer.normalize("+16505550100"), "+16505550100")
        XCTAssertEqual(PhoneNormalizer.normalize("+44 7700 900123"), "+447700900123")
    }

    func testPlusPreservesDigitsOnlyAfterPlus() {
        XCTAssertEqual(PhoneNormalizer.normalize("+1 (650) 555-0100"), "+16505550100")
    }
}
