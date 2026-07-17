import UIKit
import SwiftUI

final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        DominoFonts.register()

        let root = ShareExtensionView(
            loadInput: { [weak self] in await self?.extractSharedInput() },
            onComplete: { [weak self] in
                self?.extensionContext?.completeRequest(returningItems: nil)
            },
            onCancel: { [weak self] in
                self?.extensionContext?.cancelRequest(withError: NSError(domain: "DominoShare", code: 0))
            }
        )

        let hosting = UIHostingController(rootView: root)
        addChild(hosting)
        view.addSubview(hosting.view)
        hosting.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hosting.view.topAnchor.constraint(equalTo: view.topAnchor),
            hosting.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            hosting.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hosting.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        hosting.didMove(toParent: self)
    }

    private func extractSharedInput() async -> String? {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return nil }

        for item in items {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier("public.url") {
                    if let url = try? await loadURL(from: provider) {
                        return url.absoluteString
                    }
                }
                if provider.hasItemConformingToTypeIdentifier("public.plain-text") {
                    if let text = try? await loadText(from: provider), !text.isEmpty {
                        return text
                    }
                }
            }
            if let text = item.attributedContentText?.string, !text.isEmpty {
                return text
            }
        }
        return nil
    }

    private func loadURL(from provider: NSItemProvider) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            provider.loadItem(forTypeIdentifier: "public.url", options: nil) { item, error in
                if let error { continuation.resume(throwing: error); return }
                if let url = item as? URL { continuation.resume(returning: url); return }
                if let str = item as? String, let url = URL(string: str) { continuation.resume(returning: url); return }
                continuation.resume(throwing: NSError(domain: "DominoShare", code: 1))
            }
        }
    }

    private func loadText(from provider: NSItemProvider) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            provider.loadItem(forTypeIdentifier: "public.plain-text", options: nil) { item, error in
                if let error { continuation.resume(throwing: error); return }
                if let text = item as? String { continuation.resume(returning: text); return }
                continuation.resume(throwing: NSError(domain: "DominoShare", code: 2))
            }
        }
    }
}
