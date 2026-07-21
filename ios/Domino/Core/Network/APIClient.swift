import Foundation

final class APIClient {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = AppConfig.apiBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func request<T: Decodable>(
        _ method: String,
        path: String,
        token: String? = nil,
        query: [String: String] = [:],
        body: (any Encodable)? = nil
    ) async throws -> T {
        let url = try buildURL(path: path, query: query)

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "Invalid response")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.fromResponse(data: data, statusCode: http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func requestVoid(
        _ method: String,
        path: String,
        token: String? = nil,
        query: [String: String] = [:],
        body: (any Encodable)? = nil
    ) async throws {
        let url = try buildURL(path: path, query: query)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "Invalid response")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.fromResponse(data: data, statusCode: http.statusCode)
        }
    }

    func requestData(
        _ method: String,
        path: String,
        token: String? = nil,
        query: [String: String] = [:]
    ) async throws -> Data {
        let url = try buildURL(path: path, query: query)
        var request = URLRequest(url: url)
        request.httpMethod = method
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "Invalid response")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.fromResponse(data: data, statusCode: http.statusCode)
        }
        return data
    }

    private func buildURL(path: String, query: [String: String]) throws -> URL {
        var url = baseURL
        for component in path.split(separator: "/") {
            url = url.appendingPathComponent(String(component))
        }
        guard !query.isEmpty else { return url }
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw APIError(message: "Invalid URL")
        }
        components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let built = components.url else { throw APIError(message: "Invalid URL") }
        return built
    }
}

private struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void

    init(_ value: any Encodable) {
        encode = value.encode
    }

    func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}
