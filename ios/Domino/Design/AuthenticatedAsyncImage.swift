import SwiftUI

/// Loads authenticated images via the backend media-proxy (GCS + Twilio URLs).
struct AuthenticatedAsyncImage: View {
    let urlString: String
    let token: String

    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else if failed {
                Image(systemName: "photo")
                    .font(.title3)
                    .foregroundStyle(DominoColors.ink3)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(DominoColors.paper.opacity(0.5))
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(DominoColors.paper.opacity(0.3))
            }
        }
        .task(id: urlString) { await load() }
    }

    private func load() async {
        image = nil
        failed = false
        guard let proxyURL = DominoAPI().mediaProxyURL(for: urlString, token: token) else {
            failed = true
            return
        }
        do {
            let (data, response) = try await URLSession.shared.data(from: proxyURL)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  let uiImage = UIImage(data: data) else {
                failed = true
                return
            }
            image = uiImage
        } catch {
            failed = true
        }
    }
}
