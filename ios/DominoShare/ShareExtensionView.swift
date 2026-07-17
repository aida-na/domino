import SwiftUI

struct ShareExtensionView: View {
    let loadInput: () async -> String?
    let onComplete: () -> Void
    let onCancel: () -> Void

    @State private var preview = ""
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var saved = false

    private let api = DominoAPI()

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                DominoWordmark(size: 24)

                if isLoading {
                    ProgressView("reading share…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if saved {
                    VStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(DominoColors.accent)
                        Text("saved to domino")
                            .font(.dominoBody(18, weight: .semibold))
                        Text(looksLikeURL ? "we'll grab the title and summary." : "it's in your notes.")
                            .font(.dominoCaption(14))
                            .foregroundStyle(DominoColors.ink3)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    Text("save this to your second brain?")
                        .font(.dominoBody(15))
                        .foregroundStyle(DominoColors.ink2)

                    Text(preview.isEmpty ? "nothing to save" : preview)
                        .font(.dominoCaption(13))
                        .foregroundStyle(DominoColors.ink)
                        .lineLimit(6)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(DominoColors.paper)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(DominoColors.hairline))

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.dominoCaption(12))
                            .foregroundStyle(.red)
                    }

                    Spacer()

                    Button(action: save) {
                        Group {
                            if isSaving {
                                ProgressView().tint(.white)
                            } else {
                                Text("save to domino")
                                    .font(.dominoBody(16, weight: .semibold))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    .buttonStyle(.plain)
                    .background(DominoColors.accent)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .disabled(preview.isEmpty || isSaving)
                }
            }
            .padding()
            .background(DominoColors.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("cancel", action: onCancel)
                }
            }
            .task { await loadPreview() }
            .onChange(of: saved) { _, isSaved in
                if isSaved {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { onComplete() }
                }
            }
        }
    }

    private func loadPreview() async {
        preview = await loadInput() ?? ""
        isLoading = false
        if preview.isEmpty {
            errorMessage = "open domino and sign in first, then try again."
        } else if KeychainStore.load(account: AppConfig.sessionAccount) == nil {
            errorMessage = "sign in to the domino app first."
        }
    }

    private func save() {
        guard let token = KeychainStore.load(account: AppConfig.sessionAccount) else {
            errorMessage = "not signed in — open domino first."
            return
        }
        Task {
            isSaving = true
            errorMessage = nil
            defer { isSaving = false }
            do {
                let item = try await api.createItem(token: token, rawInput: preview)
                if item.inputType == .note {
                    _ = try? await api.enrichItem(token: token, id: item.id)
                }
                saved = true
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private var looksLikeURL: Bool {
        let t = preview.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return t.hasPrefix("http://") || t.hasPrefix("https://")
    }
}
