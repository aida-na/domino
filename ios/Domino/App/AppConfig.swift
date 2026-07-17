import Foundation

enum AppConfig {
    static let apiBaseURL = URL(string: "https://domino-414681726671.us-central1.run.app/api/v1")!
    static let keychainService = "fyi.domino.app"
    static let sessionAccount = "domino_session"
    static let phoneAccount = "domino_phone"
    static let appGroupID = "group.fyi.domino.app"

    /// Shared between app + share extension via Keychain access group.
    /// Format: `<TeamID>.group.fyi.domino.app`
    static var keychainAccessGroup: String {
        if let prefix = Bundle.main.object(forInfoDictionaryKey: "AppIdentifierPrefix") as? String,
           !prefix.isEmpty {
            return prefix.hasSuffix(".") ? "\(prefix)\(appGroupID)" : "\(prefix).\(appGroupID)"
        }
        // Fallback when Info.plist wasn't expanded (matches Config/*.xcconfig team).
        return "2CTC2JW55A.\(appGroupID)"
    }
}
