import SwiftUI

/// Pre-auth product onboarding (v3) — shown once before login.
struct FirstRunOnboardingView: View {
    let onComplete: () -> Void

    @State private var slide = 0

    private let slides: [FirstRunSlide] = FirstRunSlide.allCases

    var body: some View {
        TabView(selection: $slide) {
            ForEach(Array(slides.enumerated()), id: \.offset) { index, item in
                slidePage(item)
                    .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .animation(.easeInOut(duration: 0.28), value: slide)
        .background(OnboardingColors.paper.ignoresSafeArea())
        .safeAreaInset(edge: .top, spacing: 0) {
            HStack {
                Spacer()
                Button("skip", action: onComplete)
                    .font(.dominoBody(14))
                    .foregroundStyle(OnboardingColors.skip)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 4)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            footer
        }
    }

    private var footer: some View {
        VStack(spacing: 20) {
            HStack(spacing: 7) {
                ForEach(slides.indices, id: \.self) { index in
                    Circle()
                        .fill(index == slide ? DominoColors.accent : OnboardingColors.dotIdle)
                        .frame(width: 7, height: 7)
                }
            }

            Button(action: advance) {
                Text(slide == slides.count - 1 ? "start saving" : "next")
                    .font(.dominoBody(16, weight: .medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            }
            .buttonStyle(.plain)
            .background(DominoColors.accent)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .padding(.horizontal, 26)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .background(OnboardingColors.paper)
    }

    private func slidePage(_ item: FirstRunSlide) -> some View {
        VStack(spacing: 0) {
            OnboardingHeroIllustration(slide: item)
                .frame(maxWidth: .infinity)
                .frame(height: 260)

            VStack(alignment: .leading, spacing: 12) {
                Text(item.title)
                    .font(.dominoDisplay(25, weight: .medium))
                    .foregroundStyle(OnboardingColors.title)
                    .tracking(-0.3)
                    .fixedSize(horizontal: false, vertical: true)

                Text(item.body)
                    .font(.dominoBody(15))
                    .foregroundStyle(OnboardingColors.body)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 26)
            .padding(.top, 30)

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func advance() {
        if slide < slides.count - 1 {
            slide += 1
        } else {
            onComplete()
        }
    }
}

// MARK: - Slide copy

private enum FirstRunSlide: Int, CaseIterable {
    case saveNumber
    case linksUp
    case weekly

    var title: String {
        switch self {
        case .saveNumber: return "save our number."
        case .linksUp: return "everything links up."
        case .weekly: return "it comes back weekly."
        }
    }

    var body: String {
        switch self {
        case .saveNumber:
            return "it's the number we just texted you from. text it any link you want to keep."
        case .linksUp:
            return "domino connects each save to your other ideas, so your saves become a map, not a pile."
        case .weekly:
            return "once a week, we send you what you saved — and nudge the ones worth revisiting."
        }
    }
}

// MARK: - Colors

private enum OnboardingColors {
    static let paper = Color(red: 0.984, green: 0.973, blue: 0.953) // #FBF8F3
    static let hero = Color(red: 0.761, green: 0.322, blue: 0.118) // #C2521E
    static let heroFloor = Color(red: 0.659, green: 0.275, blue: 0.102) // #A8461A
    static let title = Color(red: 0.141, green: 0.102, blue: 0.071) // #241a12
    static let body = Color(red: 0.420, green: 0.365, blue: 0.310) // #6b5d4f
    static let skip = Color(red: 0.604, green: 0.545, blue: 0.486) // #9a8b7c
    static let dotIdle = Color(red: 0.878, green: 0.835, blue: 0.769) // #E0D5C4
    static let cardInk = Color(red: 0.227, green: 0.141, blue: 0.063) // #3A2410
    static let saveChip = Color(red: 0.953, green: 0.914, blue: 0.847) // #F3E9D8
}

// MARK: - Hero area

private struct OnboardingHeroIllustration: View {
    let slide: FirstRunSlide

    var body: some View {
        ZStack {
            OnboardingColors.hero

            VStack {
                Spacer()
                OnboardingColors.heroFloor
                    .frame(height: 50)
            }

            Group {
                switch slide {
                case .saveNumber:
                    SaveNumberIllustration()
                case .linksUp:
                    LinksGraphIllustration()
                case .weekly:
                    WeeklyDigestIllustration()
                }
            }
            .padding(.bottom, 24)
        }
        .clipped()
    }
}

private struct SaveNumberIllustration: View {
    private var formattedPhone: String {
        let digits = AppConfig.imessagePhone.filter(\.isNumber)
        guard digits.count == 11, digits.first == "1" else { return AppConfig.imessagePhone }
        let area = digits.dropFirst().prefix(3)
        let mid = digits.dropFirst(4).prefix(3)
        let last = digits.suffix(4)
        return "+1 (\(area)) \(mid)-\(last)"
    }

    var body: some View {
        VStack(spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "iphone")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(DominoColors.accent)

                VStack(alignment: .leading, spacing: 2) {
                    Text("domino")
                        .font(.dominoBody(11))
                        .foregroundStyle(OnboardingColors.skip)
                    Text(formattedPhone)
                        .font(.dominoBody(14, weight: .medium))
                        .foregroundStyle(OnboardingColors.cardInk)
                }

                Spacer(minLength: 0)

                Text("save")
                    .font(.dominoBody(12, weight: .medium))
                    .foregroundStyle(OnboardingColors.heroFloor)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(OnboardingColors.saveChip)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(OnboardingColors.paper)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: .black.opacity(0.15), radius: 12, y: 4)

            Image(systemName: "arrow.down")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(OnboardingColors.paper)
        }
        .padding(.horizontal, 32)
    }
}

private struct LinksGraphIllustration: View {
    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let nodes: [CGPoint] = [
                CGPoint(x: size.width * 0.23, y: size.height * 0.25),
                CGPoint(x: size.width * 0.79, y: size.height * 0.28),
                CGPoint(x: size.width * 0.21, y: size.height * 0.75),
                CGPoint(x: size.width * 0.77, y: size.height * 0.75),
            ]
            let lineColor = Color(red: 0.929, green: 0.894, blue: 0.816).opacity(0.6)

            for node in nodes {
                var path = Path()
                path.move(to: center)
                path.addLine(to: node)
                context.stroke(path, with: .color(lineColor), lineWidth: 1.5)
            }

            var cross = Path()
            cross.move(to: nodes[0])
            cross.addLine(to: nodes[1])
            context.stroke(cross, with: .color(lineColor.opacity(0.35)), lineWidth: 1.5)

            for node in nodes {
                let rect = CGRect(x: node.x - 9, y: node.y - 9, width: 18, height: 18)
                context.fill(Path(ellipseIn: rect), with: .color(lineColor.opacity(0.75)))
            }

            let hub = CGRect(x: center.x - 16, y: center.y - 16, width: 32, height: 32)
            context.fill(Path(ellipseIn: hub), with: .color(OnboardingColors.paper))
            context.stroke(Path(ellipseIn: hub), with: .color(OnboardingColors.paper.opacity(0.4)), lineWidth: 3)
        }
        .frame(width: 210, height: 175)
    }
}

private struct WeeklyDigestIllustration: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "envelope.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(DominoColors.accent)
                Text("your weekly domino")
                    .font(.dominoBody(11, weight: .medium))
                    .foregroundStyle(OnboardingColors.heroFloor)
            }

            Text("3 things you saved this week — and one worth another look.")
                .font(.dominoBody(13))
                .foregroundStyle(OnboardingColors.cardInk)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: 220)
        .background(OnboardingColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.2), radius: 16, y: 6)
        .padding(.horizontal, 24)
    }
}

#Preview {
    FirstRunOnboardingView(onComplete: {})
}
