import Foundation

struct APIError: LocalizedError {
    let message: String
    var code: String?
    var errorDescription: String? { message }

    static func fromResponse(data: Data, statusCode: Int) -> APIError {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let detail = json["detail"] as? String {
                return APIError(message: detail)
            }
            if let detail = json["detail"] as? [String: Any] {
                let message = (detail["message"] as? String)
                    ?? (detail["detail"] as? String)
                    ?? "Request failed (\(statusCode))"
                let code = detail["code"] as? String
                return APIError(message: message, code: code)
            }
            if let details = json["detail"] as? [[String: Any]] {
                let msgs = details.compactMap { $0["msg"] as? String }
                if !msgs.isEmpty { return APIError(message: msgs.joined(separator: ", ")) }
            }
        }
        return APIError(message: "Request failed (\(statusCode))")
    }
}
