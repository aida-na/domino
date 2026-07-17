import Foundation

enum PhoneNormalizer {
    /// Mirrors backend E.164 normalization for US numbers.
    static func normalize(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        if raw.hasPrefix("+") { return "+\(digits)" }
        if digits.count == 10 { return "+1\(digits)" }
        if digits.count == 11, digits.hasPrefix("1") { return "+\(digits)" }
        return "+\(digits)"
    }
}
