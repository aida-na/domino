import SwiftUI

@main
struct DominoApp: App {
    @State private var auth = AuthSession()

    init() {
        DominoFonts.register()
        DominoAnalytics.setup()
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(DominoColors.bg)
                } else if auth.showMainApp {
                    MainTabView()
                } else {
                    AuthFlowView()
                }
            }
            .environment(auth)
            .font(.dominoBody(16))
            // Design tokens are light-surface only; without this, Dark Mode makes
            // TextField/SecureField text white on white paper backgrounds.
            .preferredColorScheme(.light)
            .task { await auth.bootstrap() }
            .onOpenURL { url in
                handleIncomingURL(url)
            }
        }
    }

    private func handleIncomingURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }

        if let ref = components.queryItems?.first(where: { $0.name == "ref" })?.value,
           !ref.isEmpty {
            UserDefaults.standard.set(ref, forKey: AppConfig.inviteRefKey)
        }

        // Universal link: https://domino.fyi/dashboard?token=<uuid>
        // Custom scheme: domino://dashboard?token=<uuid>
        guard let token = components.queryItems?.first(where: { $0.name == "token" })?.value else {
            return
        }
        Task { try? await auth.loginWithToken(token) }
    }
}
