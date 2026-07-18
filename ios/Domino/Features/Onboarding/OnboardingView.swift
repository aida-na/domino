import SwiftUI
import UIKit

enum OnboardingStep: Int {
    case save
    case email
}

struct OnboardingView: View {
    let hasItems: Bool
    let hasEmail: Bool
    let initialEmail: String?
    let onComplete: () -> Void
    let onEmailSaved: (String) -> Void

    @Environment(AuthSession.self) private var auth
    @State private var step: OnboardingStep
    @State private var includeSaveStep: Bool
    @State private var email: String
    @State private var saving = false
    @State private var errorMessage: String?

    private let api = DominoAPI()

    init(
        hasItems: Bool,
        hasEmail: Bool,
        initialEmail: String?,
        onComplete: @escaping () -> Void,
        onEmailSaved: @escaping (String) -> Void
    ) {
        self.hasItems = hasItems
        self.hasEmail = hasEmail
        self.initialEmail = initialEmail
        self.onComplete = onComplete
        self.onEmailSaved = onEmailSaved
        let startOnEmail = hasItems && !hasEmail
        _step = State(initialValue: startOnEmail ? .email : .save)
        _includeSaveStep = State(initialValue: !hasItems)
        _email = State(initialValue: initialEmail ?? "")
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture { finish() }

            VStack(spacing: 0) {
                header
                illustration
                    .frame(height: 112)
                    .padding(.top, 4)

                Group {
                    if step == .save {
                        saveContent
                    } else {
                        emailContent
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
            .frame(maxWidth: 360)
            .background(DominoColors.paper)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.black.opacity(0.08), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.2), radius: 32, y: 16)
            .padding(.horizontal, 22)
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            if includeSaveStep {
                stepDots
                stepSwitch
            } else {
                Text("almost")
                    .font(.dominoBody(12, weight: .semibold))
                    .foregroundStyle(DominoColors.ink4)
                    .textCase(.uppercase)
                    .tracking(0.8)
            }
            Spacer()
            DominoCloseButton(action: finish)
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
    }

    private var stepDots: some View {
        HStack(spacing: 5) {
            Capsule()
                .fill(step == .save ? DominoColors.ink : DominoColors.hairline)
                .frame(width: step == .save ? 14 : 5, height: 5)
            Capsule()
                .fill(step == .email ? DominoColors.ink : DominoColors.hairline)
                .frame(width: step == .email ? 14 : 5, height: 5)
        }
    }

    private var stepSwitch: some View {
        Group {
            if step == .save {
                Button {
                    if hasEmail { finish() } else { step = .email }
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(DominoColors.ink)
                        .frame(width: 28, height: 28)
                        .overlay(Circle().stroke(DominoColors.hairline, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("next")
            } else {
                Button {
                    step = .save
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(DominoColors.ink)
                        .frame(width: 28, height: 28)
                        .overlay(Circle().stroke(DominoColors.hairline, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("previous")
            }
        }
    }

    @ViewBuilder
    private var illustration: some View {
        if step == .save {
            SaveIllustration()
        } else {
            DigestIllustration()
        }
    }

    private var saveContent: some View {
        VStack(spacing: 6) {
            Text("save your first thing")
                .font(.dominoDisplay(26, weight: .bold))
                .foregroundStyle(DominoColors.ink)
                .multilineTextAlignment(.center)

            Text("send a link to domino on iMessage. it will appear on the dashboard.")
                .font(.dominoBody(15))
                .foregroundStyle(DominoColors.ink2)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Button(action: openIMessage) {
                Text("open iMessage")
                    .font(.dominoBody(16, weight: .semibold))
                    .foregroundStyle(DominoColors.paper)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(DominoColors.ink)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.top, 14)
        }
    }

    private var emailContent: some View {
        VStack(spacing: 6) {
            Text("weekly digest")
                .font(.dominoDisplay(26, weight: .bold))
                .foregroundStyle(DominoColors.ink)
                .multilineTextAlignment(.center)

            Text("your best saves, emailed once a week.")
                .font(.dominoBody(15))
                .foregroundStyle(DominoColors.ink2)
                .multilineTextAlignment(.center)

            TextField("you@example.com", text: $email)
                .font(.dominoBody(16))
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(DominoColors.bg)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(DominoColors.hairline, lineWidth: 1)
                )
                .padding(.top, 10)

            if let errorMessage {
                Text(errorMessage)
                    .font(.dominoBody(13))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await saveEmail() }
            } label: {
                Text(saving ? "saving…" : "continue")
                    .font(.dominoBody(16, weight: .semibold))
                    .foregroundStyle(email.trim().isEmpty || saving ? DominoColors.ink4 : DominoColors.paper)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(email.trim().isEmpty || saving ? DominoColors.chipIdle : DominoColors.ink)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(email.trim().isEmpty || saving)
            .padding(.top, 14)
        }
    }

    private func openIMessage() {
        guard let url = AppConfig.imessageURL else { return }
        UIApplication.shared.open(url)
    }

    private func saveEmail() async {
        let trimmed = email.trim()
        guard !trimmed.isEmpty, let token = auth.sessionToken else { return }
        saving = true
        errorMessage = nil
        defer { saving = false }
        do {
            let me = try await api.updateMe(
                token: token,
                patch: ProfileUpdate(email: trimmed, digestOptedOut: false)
            )
            onEmailSaved(me.email ?? trimmed)
            finish()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func finish() {
        UserDefaults.standard.set(true, forKey: AppConfig.onboardingDefaultsKey)
        onComplete()
    }
}

// MARK: - Illustrations

private struct SaveIllustration: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(red: 0.96, green: 0.95, blue: 0.93))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(DominoColors.ink, lineWidth: 1.5))
                .frame(width: 52, height: 64)
                .rotationEffect(.degrees(-8))
                .offset(x: -42, y: 8)

            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(DominoColors.ink)
                .frame(width: 52, height: 72)
                .overlay {
                    VStack(alignment: .leading, spacing: 7) {
                        Capsule().fill(Color.white.opacity(0.55)).frame(width: 28, height: 3)
                        Capsule().fill(Color.white.opacity(0.35)).frame(width: 22, height: 3)
                        Capsule().fill(Color.white.opacity(0.25)).frame(width: 26, height: 3)
                        Spacer(minLength: 0)
                        Image(systemName: "plus")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.85))
                            .frame(maxWidth: .infinity)
                            .padding(.bottom, 10)
                    }
                    .padding(.top, 14)
                    .padding(.horizontal, 12)
                }

            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(red: 0.96, green: 0.95, blue: 0.93))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(DominoColors.ink, lineWidth: 1.5))
                .frame(width: 52, height: 62)
                .rotationEffect(.degrees(8))
                .offset(x: 42, y: 10)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct DigestIllustration: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(red: 0.96, green: 0.95, blue: 0.93))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(DominoColors.ink, lineWidth: 1.5))
                .frame(width: 104, height: 56)

            Path { path in
                path.move(to: CGPoint(x: 0, y: 0))
                path.addLine(to: CGPoint(x: 52, y: 30))
                path.addLine(to: CGPoint(x: 104, y: 0))
                path.closeSubpath()
            }
            .fill(DominoColors.ink)
            .frame(width: 104, height: 56)
            .offset(y: -4)
        }
        .frame(maxWidth: .infinity)
    }
}

private extension String {
    func trim() -> String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

enum OnboardingStore {
    static var isDone: Bool {
        UserDefaults.standard.bool(forKey: AppConfig.onboardingDefaultsKey)
    }

    static func markDone() {
        UserDefaults.standard.set(true, forKey: AppConfig.onboardingDefaultsKey)
    }
}
