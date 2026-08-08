import SwiftUI

/// Pre-login welcome — hero tiles, tagline, and entry to sign-in.
struct AuthLandingView: View {
    let onContinue: () -> Void

    private let landingBg = Color(red: 0.984, green: 0.976, blue: 0.969) // #FBF9F7

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 20)

            Image("DominoBrand")
                .resizable()
                .scaledToFill()
                .frame(maxWidth: 300)
                .aspectRatio(1024 / 764, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .shadow(color: DominoColors.accent.opacity(0.18), radius: 16, y: 8)
                .padding(.horizontal, 44)

            Spacer(minLength: 28)

            VStack(spacing: 12) {
                Text("domino")
                    .font(.dominoLogo(38))
                    .foregroundStyle(DominoColors.ink)
                    .tracking(-0.4)

                DominoAccentSquiggle()
                    .frame(width: 52, height: 10)

                Text("the things you save, when you actually need them.")
                    .font(.dominoBody(16))
                    .foregroundStyle(DominoColors.ink3)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 32)
            }

            Spacer(minLength: 36)

            Button(action: onContinue) {
                Text("Get started")
                    .font(.dominoBody(16, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            }
            .buttonStyle(.plain)
            .background(DominoColors.accent)
            .foregroundStyle(.white)
            .clipShape(Capsule())
            .shadow(color: DominoColors.accent.opacity(0.28), radius: 12, y: 6)
            .padding(.horizontal, 32)
            .padding(.bottom, max(32, 24))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(landingBg.ignoresSafeArea())
    }
}

/// Smooth orange wave accent under the wordmark.
private struct DominoAccentSquiggle: View {
    var body: some View {
        Canvas { context, size in
            let w = size.width
            let h = size.height
            let midY = h * 0.52
            let amplitude = h * 0.42

            var path = Path()
            path.move(to: CGPoint(x: 0, y: midY))
            path.addCurve(
                to: CGPoint(x: w, y: midY),
                control1: CGPoint(x: w * 0.28, y: midY + amplitude),
                control2: CGPoint(x: w * 0.72, y: midY - amplitude)
            )

            context.stroke(
                path,
                with: .color(DominoColors.accent),
                style: StrokeStyle(lineWidth: 2.75, lineCap: .round, lineJoin: .round)
            )
        }
    }
}

#Preview {
    AuthLandingView(onContinue: {})
}
