import Foundation
import Security

enum KeychainStore {
    static func save(_ value: String, account: String) throws {
        let data = Data(value.utf8)
        // Prefer shared access group (app ↔ share extension). Fall back to the
        // app's default keychain when the group entitlement isn't available
        // (unsigned simulator builds, missing App Group capability, etc.).
        let sharedStatus = add(data: data, account: account, accessGroup: AppConfig.keychainAccessGroup)
        if sharedStatus == errSecSuccess { return }

        let fallbackStatus = add(data: data, account: account, accessGroup: nil)
        guard fallbackStatus == errSecSuccess else {
            throw APIError(message: "Failed to save credentials (\(sharedStatus)/\(fallbackStatus))")
        }
    }

    static func load(account: String) -> String? {
        if let value = copy(account: account, accessGroup: AppConfig.keychainAccessGroup) {
            return value
        }
        return copy(account: account, accessGroup: nil)
    }

    static func delete(account: String) {
        delete(account: account, accessGroup: AppConfig.keychainAccessGroup)
        delete(account: account, accessGroup: nil)
    }

    static func clearAll() {
        delete(account: AppConfig.sessionAccount)
        delete(account: AppConfig.phoneAccount)
    }

    // MARK: - Private

    private static func add(data: Data, account: String, accessGroup: String?) -> OSStatus {
        var query: [String: Any] = baseQuery(account: account, accessGroup: accessGroup)
        SecItemDelete(query as CFDictionary)

        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(query as CFDictionary, nil)
    }

    private static func copy(account: String, accessGroup: String?) -> String? {
        var query = baseQuery(account: account, accessGroup: accessGroup)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func delete(account: String, accessGroup: String?) {
        SecItemDelete(baseQuery(account: account, accessGroup: accessGroup) as CFDictionary)
    }

    private static func baseQuery(account: String, accessGroup: String?) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AppConfig.keychainService,
            kSecAttrAccount as String: account,
        ]
        if let accessGroup, !accessGroup.isEmpty {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        return query
    }
}
