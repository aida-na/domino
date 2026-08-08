import SwiftUI

/// Landing → login. Product carousel runs after sign-in.
struct AuthFlowView: View {
    private enum Step {
        case landing
        case login
    }

    @State private var step: Step = .landing

    var body: some View {
        Group {
            switch step {
            case .landing:
                AuthLandingView(onContinue: goToLogin)
                    .transition(.opacity)
            case .login:
                LoginView(
                    onBack: { withAnimation(.easeInOut(duration: 0.28)) { step = .landing } }
                )
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.28), value: step)
    }

    private func goToLogin() {
        withAnimation(.easeInOut(duration: 0.28)) {
            step = .login
        }
    }
}

#Preview {
    AuthFlowView()
        .environment(AuthSession())
}
