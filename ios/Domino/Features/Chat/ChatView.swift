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
                                Text("ask anything about what you've saved via iMessage.")
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
                    TextField("ask about your saves…", text: $input, axis: .vertical)
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
            .navigationTitle("chat")
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

                if let sources = message.sources, !sources.isEmpty {
                    Text("\(sources.count) source\(sources.count == 1 ? "" : "s")")
                        .font(.caption2)
                        .foregroundStyle(DominoColors.ink3)
                }
            }

            if message.role == .assistant { Spacer(minLength: 48) }
        }
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
