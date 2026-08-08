import SwiftUI

struct ChatView: View {
    @Environment(AuthSession.self) private var auth
    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var isSending = false

    private let api = DominoAPI()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            if messages.isEmpty {
                                Text("search or ask anything about what you've saved via iMessage.")
                                    .font(.subheadline)
                                    .foregroundStyle(DominoColors.ink3)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.top, 24)
                            }
                            ForEach(messages) { message in
                                messageBubble(message)
                                    .id(message.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) { _, _ in
                        if let last = messages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }

                HStack(spacing: 12) {
                    TextField("search or ask your domino…", text: $input, axis: .vertical)
                        .lineLimit(1...4)
                        .padding(12)
                        .background(DominoColors.paper)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(DominoColors.hairline))

                    Button {
                        Task { await send() }
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundStyle(input.isEmpty ? DominoColors.ink3 : DominoColors.accent)
                    }
                    .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                }
                .padding()
                .background(DominoColors.bg)
            }
            .background(DominoColors.bg)
            .navigationTitle("ask")
        }
    }

    @ViewBuilder
    private func messageBubble(_ message: ChatMessage) -> some View {
        HStack {
            if message.role == .user { Spacer(minLength: 48) }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 6) {
                Text(message.text)
                    .font(.body)
                    .foregroundStyle(message.role == .user ? .white : DominoColors.ink)
                    .padding(12)
                    .background(message.role == .user ? DominoColors.accent : DominoColors.paper)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                if message.role == .assistant, let sources = message.sources, !sources.isEmpty {
                    sourceCards(sources)
                }
            }
            .frame(maxWidth: message.role == .assistant ? .infinity : nil, alignment: message.role == .user ? .trailing : .leading)

            if message.role == .assistant { Spacer(minLength: 48) }
        }
    }

    @ViewBuilder
    private func sourceCards(_ sources: [ChatSource]) -> some View {
        VStack(spacing: 6) {
            ForEach(sources) { source in
                if source.isLink, let url = URL(string: source.rawInput) {
                    Link(destination: url) {
                        sourceCardLabel(source, icon: "link")
                    }
                    .buttonStyle(.plain)
                } else {
                    Button {
                        input = "Tell me about: \"\(source.displayLabel)\""
                    } label: {
                        sourceCardLabel(source, icon: "note.text")
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sourceCardLabel(_ source: ChatSource, icon: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(DominoColors.accent)
                .frame(width: 16, height: 16)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 2) {
                Text(source.displayLabel)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(DominoColors.ink)
                    .multilineTextAlignment(.leading)

                if let topic = source.topic, !topic.isEmpty {
                    Text(topic)
                        .font(.caption2)
                        .foregroundStyle(DominoColors.ink3)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(DominoColors.paper)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(DominoColors.hairline))
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
