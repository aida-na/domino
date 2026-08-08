import SwiftUI

private let askStarters = [
    "what did i save this week?",
    "summarize what i've been reading",
    "what are my recurring themes?",
]

struct ChatView: View {
    @Environment(AuthSession.self) private var auth
    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var isSending = false
    @FocusState private var inputFocused: Bool

    private let api = DominoAPI()

    private var isEmpty: Bool { messages.isEmpty && !isSending }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isEmpty {
                    emptyState
                } else {
                    conversation
                }
                inputBar
            }
            .background(DominoColors.bg)
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 22) {
            Spacer()

            DotRow(tones: [DominoColors.accent, DominoColors.card("o"), DominoColors.hairline], size: 11)

            Text("ask for anything\nyou've ever saved.")
                .font(.dominoDisplay(34, weight: .bold))
                .foregroundStyle(DominoColors.ink)
                .tracking(-0.6)
                .lineSpacing(2)

            Text("domino remembers every link and half-thought you sent it. try one of these:")
                .font(.dominoBody(16))
                .foregroundStyle(DominoColors.ink3)
                .lineSpacing(3)
                .frame(maxWidth: 290, alignment: .leading)

            VStack(alignment: .leading, spacing: 10) {
                ForEach(askStarters, id: \.self) { starter in
                    Button {
                        input = starter
                        inputFocused = true
                    } label: {
                        Text(starter)
                            .font(.dominoBody(15))
                            .foregroundStyle(DominoColors.ink2)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .background(DominoColors.paper)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(DominoColors.hairline, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 26)
    }

    // MARK: - Conversation

    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    ForEach(messages) { message in
                        messageView(message).id(message.id)
                    }
                    if isSending {
                        DotRow(tones: [DominoColors.accent, DominoColors.card("o"), DominoColors.hairline], size: 7)
                            .padding(.vertical, 4)
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 8)
            }
            .onChange(of: messages.count) { _, _ in
                if let last = messages.last {
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
        }
    }

    @ViewBuilder
    private func messageView(_ message: ChatMessage) -> some View {
        if message.role == .user {
            HStack {
                Spacer(minLength: 48)
                Text(message.text)
                    .font(.dominoBody(16))
                    .foregroundStyle(.white)
                    .lineSpacing(2)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 13)
                    .background(DominoColors.accent)
                    .clipShape(UnevenRoundedRectangle(
                        topLeadingRadius: 22,
                        bottomLeadingRadius: 22,
                        bottomTrailingRadius: 6,
                        topTrailingRadius: 22,
                        style: .continuous
                    ))
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        } else {
            VStack(alignment: .leading, spacing: 14) {
                if let sources = message.sources, !sources.isEmpty {
                    HStack(spacing: 8) {
                        DotRow(tones: [DominoColors.accent, DominoColors.card("o")], size: 7)
                        Text(sources.count == 1 ? "1 MATCH" : "\(sources.count) MATCHES")
                            .font(.dominoBody(12, weight: .semibold))
                            .tracking(0.7)
                            .foregroundStyle(DominoColors.ink4)
                    }
                }

                Text(message.text)
                    .font(.dominoBody(17))
                    .foregroundStyle(DominoColors.ink)
                    .lineSpacing(5)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                if let sources = message.sources, !sources.isEmpty {
                    VStack(spacing: 10) {
                        ForEach(sources) { source in
                            sourceCard(source)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func sourceCard(_ source: ChatSource) -> some View {
        if source.isLink, let url = URL(string: source.rawInput) {
            Link(destination: url) { sourceCardLabel(source) }
                .buttonStyle(.plain)
        } else {
            Button {
                input = "Tell me about: \"\(source.displayLabel)\""
                inputFocused = true
            } label: {
                sourceCardLabel(source)
            }
            .buttonStyle(.plain)
        }
    }

    private func sourceCardLabel(_ source: ChatSource) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: source.isLink ? "link" : "note.text")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(DominoColors.accent)
                .frame(width: 46, height: 46)
                .background(DominoColors.card("o"))
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(source.displayLabel)
                    .font(.dominoBody(15, weight: .semibold))
                    .foregroundStyle(DominoColors.ink)
                    .multilineTextAlignment(.leading)
                    .lineLimit(3)

                if let meta = sourceMeta(source) {
                    Text(meta)
                        .font(.dominoBody(12))
                        .foregroundStyle(DominoColors.ink3)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(DominoColors.ink4)
                .padding(.top, 4)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 10, y: 2)
    }

    private func sourceMeta(_ source: ChatSource) -> String? {
        var parts: [String] = []
        if let host = URL(string: source.rawInput)?.host {
            parts.append(host.replacingOccurrences(of: "www.", with: ""))
        }
        if let topic = source.topic, !topic.isEmpty {
            parts.append(topic)
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    // MARK: - Input

    private var canSend: Bool {
        !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField(isEmpty ? "search or ask your domino…" : "ask a follow-up…", text: $input, axis: .vertical)
                .font(.dominoBody(16))
                .foregroundStyle(DominoColors.ink)
                .tint(DominoColors.accent)
                .lineLimit(1...4)
                .focused($inputFocused)
                .padding(.vertical, 11)

            Button {
                Task { await send() }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(canSend ? Color.white : DominoColors.ink4)
                    .frame(width: 38, height: 38)
                    .background(canSend ? DominoColors.accent : DominoColors.chipIdle)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
        }
        .padding(.leading, 20)
        .padding(.trailing, 6)
        .padding(.vertical, 6)
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(DominoColors.hairline, lineWidth: 1))
        .shadow(color: .black.opacity(0.04), radius: 10, y: 2)
        .padding(.horizontal, 22)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private func send() async {
        guard let token = auth.sessionToken else { return }
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        input = ""
        messages.append(ChatMessage(role: .user, text: text, sources: nil))
        DominoAnalytics.capture("chat_question_sent")
        isSending = true
        defer { isSending = false }

        do {
            let response = try await api.chat(token: token, message: text)
            messages.append(ChatMessage(role: .assistant, text: response.answer, sources: response.sources))
        } catch {
            messages.append(ChatMessage(role: .assistant, text: error.localizedDescription, sources: nil))
        }
    }
}

#Preview {
    ChatView()
        .environment(AuthSession())
}
