import Foundation

enum AppConfig {
    static let apiBaseURL: URL = {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String,
           let url = URL(string: raw) {
            return url
        }
        // Fallback for previews / misconfigured builds
        return URL(string: "https://domino-414681726671.us-central1.run.app/api/v1")!
    }()
    static let keychainService = "fyi.domino.app"
    static let sessionAccount = "domino_session"
    static let phoneAccount = "domino_phone"
    static let appGroupID = "group.fyi.domino.app"
    /// Public Domino iMessage number — opens Messages via `sms:`.
    static let imessagePhone = "+14249441140"
    static let onboardingDefaultsKey = "domino_onboarding_v1"
    /// Post-auth v3 carousel (save number → links → weekly) after login.
    static let firstRunOnboardingKey = "domino_first_run_onboarding_v4"
    static let inviteRefKey = "domino_invite_ref"

    static let posthogProjectToken: String? = {
        Bundle.main.object(forInfoDictionaryKey: "PostHogProjectToken") as? String
    }()

    static let posthogHost: String? = {
        Bundle.main.object(forInfoDictionaryKey: "PostHogHost") as? String
    }()

    static var imessageURL: URL? {
        URL(string: "sms:\(imessagePhone)")
    }

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
