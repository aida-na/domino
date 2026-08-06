import Foundation
#if canImport(PostHog)
import PostHog
#endif

enum DominoAnalytics {
    static func setup() {
        #if canImport(PostHog)
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
        #endif
    }

    static func identify(phone: String) {
        #if canImport(PostHog)
        guard !phone.isEmpty else { return }
        PostHogSDK.shared.identify(phone)
        #endif
    }

    static func reset() {
        #if canImport(PostHog)
        PostHogSDK.shared.reset()
        #endif
    }

    static func capture(_ event: String, properties: [String: Any]? = nil) {
        #if canImport(PostHog)
        PostHogSDK.shared.capture(event, properties: properties)
        #endif
    }
}
