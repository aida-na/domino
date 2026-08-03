import Foundation
import PostHog

enum DominoAnalytics {
    static func setup() {
        guard let token = AppConfig.posthogProjectToken,
              !token.isEmpty,
              let host = AppConfig.posthogHost,
              !host.isEmpty else {
            return
        }

        let config = PostHogConfig(projectToken: token, host: host)
        config.captureApplicationLifecycleEvents = true
        config.captureScreenViews = true
        PostHogSDK.shared.setup(config)
    }

    static func identify(phone: String) {
        guard !phone.isEmpty else { return }
        PostHogSDK.shared.identify(phone)
    }

    static func reset() {
        PostHogSDK.shared.reset()
    }

    static func capture(_ event: String, properties: [String: Any]? = nil) {
        PostHogSDK.shared.capture(event, properties: properties)
    }
}
