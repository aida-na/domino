import SwiftUI

/// First-run onboarding → login, mirroring the web landing → /login flow.
struct AuthFlowView: View {
    @AppStorage(AppConfig.firstRunOnboardingKey) private var firstRunComplete = false

    var body: some View {
        Group {
            if firstRunComplete {
                LoginView()
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            } else {
                FirstRunOnboardingView {
                    withAnimation(.easeInOut(duration: 0.32)) {
                        firstRunComplete = true
                    }
                }
                .transition(.opacity)
            }
        }
    }
}

#Preview {
    AuthFlowView()
        .environment(AuthSession())
}
