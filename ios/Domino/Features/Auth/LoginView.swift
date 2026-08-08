import SwiftUI

enum LoginMode: String, CaseIterable {
    case otp = "iMessage"
    case password = "password"
}

struct LoginView: View {
    @Environment(AuthSession.self) private var auth
    var onBack: (() -> Void)?
    @State private var mode: LoginMode = .otp
    @State private var phone = "+1"
    @State private var code = ""
    @State private var password = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var step: OTPStep = .phone
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var noticeMessage: String?
    @State private var signupFull = false
    @State private var showWaitlist = false
    @State private var waitlistEmail = ""
    @State private var waitlistNotice: String?

    private let api = DominoAPI()

    enum OTPStep { case phone, code, setPassword }

    init(onBack: (() -> Void)? = nil) {
        self.onBack = onBack
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if let onBack {
                    HStack {
                        Button(action: onBack) {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 14, weight: .semibold))
                                Text("back")
                            }
                            .font(.dominoBody(14))
                            .foregroundStyle(DominoColors.ink3)
                        }
                        .buttonStyle(.plain)
                        Spacer()
                    }
                    .padding(.top, 4)
                }

                Spacer(minLength: onBack == nil ? 16 : 0)

                authHeader

                VStack(spacing: 14) {
                    if step != .setPassword {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("phone number")
                                .font(.dominoBody(12, weight: .semibold))
                                .foregroundStyle(DominoColors.ink3)
                                .textCase(.lowercase)
                            TextField("(650) 555-0100", text: $phone)
                                .keyboardType(.phonePad)
                                .textContentType(.telephoneNumber)
                                .fieldStyle()
                        }
                    }

                    if mode == .otp, step == .code {
                        Text("check iMessage for your code, sent to \(phone)")
                            .font(.dominoBody(13))
                            .foregroundStyle(DominoColors.ink3)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        TextField("6-digit code", text: $code)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .fieldStyle()
                            .onChange(of: code) { _, value in
                                code = String(value.filter(\.isNumber).prefix(6))
                            }
                    }

                    if mode == .password, step != .setPassword {
                        SecureField("password", text: $password)
                            .textContentType(.password)
                            .fieldStyle()
                    }

                    if step == .setPassword {
                        Text("optional: add a password so you can sign in without a code next time.")
                            .font(.dominoBody(13))
                            .foregroundStyle(DominoColors.ink3)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        SecureField("new password (min 8 characters)", text: $newPassword)
                            .textContentType(.newPassword)
                            .fieldStyle()

                        SecureField("confirm password", text: $confirmPassword)
                            .textContentType(.newPassword)
                            .fieldStyle()
                    }
                }

                if let noticeMessage {
                    Text(noticeMessage)
                        .font(.dominoBody(13))
                        .foregroundStyle(DominoColors.ink2)
                        .multilineTextAlignment(.center)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.dominoBody(13))
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }

                Button(action: submit) {
                    Group {
                        if isLoading {
                            ProgressView().tint(.white)
                        } else {
                            Text(primaryButtonTitle)
                                .font(.dominoBody(16, weight: .semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                }
                .buttonStyle(.plain)
                .background(DominoColors.accent)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .disabled(isLoading || !canSubmit)

                if mode == .otp, step == .phone {
                    Button("use password instead") {
                        mode = .password
                        errorMessage = nil
                        noticeMessage = nil
                    }
                    .font(.dominoBody(14))
                    .foregroundStyle(DominoColors.ink3)
                }

                if mode == .password, step != .setPassword {
                    Button("use iMessage code instead") {
                        mode = .otp
                        step = .phone
                        password = ""
                        errorMessage = nil
                    }
                    .font(.dominoBody(14))
                    .foregroundStyle(DominoColors.ink3)
                }

                if mode == .otp, step == .code {
                    HStack {
                        Button("back") {
                            step = .phone
                            code = ""
                            errorMessage = nil
                        }
                        Spacer()
                        Button("resend code") {
                            Task {
                                do {
                                    try await requestOTP()
                                    noticeMessage = "sent a new code — check iMessage."
                                } catch {
                                    errorMessage = error.localizedDescription
                                }
                            }
                        }
                    }
                    .font(.dominoBody(14))
                    .foregroundStyle(DominoColors.ink3)
                }

                if step == .setPassword {
                    Button("skip for now") {
                        auth.finishPasswordSetup()
                    }
                    .font(.dominoBody(14))
                    .foregroundStyle(DominoColors.ink3)
                }

                if showWaitlist {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("join the waitlist")
                            .font(.dominoBody(14, weight: .semibold))
                            .foregroundStyle(DominoColors.ink)
                        Text("we only let a few people in each day. leave your email and we’ll ping you.")
                            .font(.dominoBody(12))
                            .foregroundStyle(DominoColors.ink3)
                        TextField("email", text: $waitlistEmail)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .fieldStyle()
                        Button("join waitlist") {
                            Task { await submitWaitlist() }
                        }
                        .font(.dominoBody(14, weight: .semibold))
                        .foregroundStyle(DominoColors.accent)
                        if let waitlistNotice {
                            Text(waitlistNotice)
                                .font(.dominoBody(12))
                                .foregroundStyle(DominoColors.ink2)
                        }
                    }
                    .padding(16)
                    .background(DominoColors.paper)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(DominoColors.hairline))
                } else if signupFull, step == .phone {
                    Button("full today? join waitlist") {
                        showWaitlist = true
                    }
                    .font(.dominoBody(12))
                    .foregroundStyle(DominoColors.ink4)
                }

                Spacer(minLength: 40)
            }
            .padding(.horizontal, 24)
        }
        .background(DominoColors.bg.ignoresSafeArea())
        .task { await loadSignupStatus() }
    }

    private var authHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            DominoPageTitle(title: headerTitle, size: 32)
            if let headerSubtitle {
                Text(headerSubtitle)
                    .font(.dominoBody(15))
                    .foregroundStyle(DominoColors.ink3)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var headerTitle: String {
        switch step {
        case .code: return "verify code"
        case .setPassword: return "set a password"
        case .phone: return "sign in"
        }
    }

    private var headerSubtitle: String? {
        switch step {
        case .code, .setPassword:
            return nil
        case .phone:
            if mode == .password {
                return "enter the password you saved after your first sign-in."
            }
            return "enter your phone — we'll iMessage you a code."
        }
    }

    private func loadSignupStatus() async {
        guard let status = try? await api.getSignupStatus(), status.full else { return }
        signupFull = true
        showWaitlist = true
    }

    private var canSubmit: Bool {
        switch step {
        case .phone, .code:
            return phone.filter(\.isNumber).count >= 10
                && (mode != .otp || step == .phone || code.count == 6)
                && (mode != .password || !password.isEmpty)
        case .setPassword:
            return newPassword.count >= 8 && newPassword == confirmPassword
        }
    }

    private var primaryButtonTitle: String {
        switch step {
        case .setPassword: return "save password"
        default:
            switch mode {
            case .otp: return step == .phone ? "send code" : "verify"
            case .password: return "sign in"
            }
        }
    }

    private func submit() {
        Task {
            isLoading = true
            errorMessage = nil
            noticeMessage = nil
            defer { isLoading = false }

            do {
                if step == .setPassword {
                    try await auth.setPassword(password: newPassword, confirm: confirmPassword)
                    DominoAnalytics.capture("password_setup_completed")
                    auth.finishPasswordSetup()
                    return
                }

                let normalized = PhoneNormalizer.normalize(phone)
                switch mode {
                case .otp:
                    if step == .phone {
                        try await requestOTP(normalized: normalized)
                        DominoAnalytics.capture("otp_requested")
                    } else {
                        let ref = UserDefaults.standard.string(forKey: AppConfig.inviteRefKey)
                        let tokens = try await api.verifyOTP(phone: normalized, code: code, ref: ref)
                        if ref != nil {
                            UserDefaults.standard.removeObject(forKey: AppConfig.inviteRefKey)
                        }
                        try await auth.completeLogin(tokens: tokens, promptPasswordSetup: true)
                        DominoAnalytics.capture("otp_verified", properties: ["has_password": tokens.hasPassword])
                        if !tokens.hasPassword {
                            step = .setPassword
                        }
                    }
                case .password:
                    let tokens = try await api.loginWithPassword(phone: normalized, password: password)
                    try await auth.completeLogin(tokens: tokens)
                    DominoAnalytics.capture("password_login_completed")
                }
            } catch let apiError as APIError where apiError.code == "signup_full" {
                errorMessage = apiError.message
                signupFull = true
                showWaitlist = true
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func requestOTP(normalized: String? = nil) async throws {
        let p = normalized ?? PhoneNormalizer.normalize(phone)
        _ = try await api.requestOTP(phone: p)
        step = .code
    }

    private func submitWaitlist() async {
        let email = waitlistEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard email.contains("@") else {
            waitlistNotice = "enter a valid email."
            return
        }
        do {
            _ = try await api.joinWaitlist(email: email, ref: UserDefaults.standard.string(forKey: AppConfig.inviteRefKey))
            DominoAnalytics.capture("waitlist_joined", properties: ["referral_present": UserDefaults.standard.string(forKey: AppConfig.inviteRefKey) != nil])
            waitlistNotice = "you're on the list — we'll be in touch."
            waitlistEmail = ""
        } catch {
            waitlistNotice = error.localizedDescription
        }
    }
}

private extension View {
    func fieldStyle() -> some View {
        self
            // Explicit ink — system Dark Mode defaults TextField/SecureField text to white,
            // which disappears on DominoColors.paper.
            .foregroundStyle(DominoColors.ink)
            .tint(DominoColors.accent)
            .padding()
            .background(DominoColors.paper)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(DominoColors.hairline))
    }
}

#Preview {
    LoginView()
        .environment(AuthSession())
}
