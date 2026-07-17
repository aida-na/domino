import SwiftUI
import Observation

/// Lightweight tab routing: Saved / Map / Discover. Profile opens from Discover only.
@Observable
@MainActor
final class AppNavigation {
    /// 0 saved · 1 map · 2 discover
    var selectedTab: Int = 0
    /// When set, Saved applies this sort once then clears it.
    var pendingDashboardSort: ItemSort?
    /// When set, Saved filters to this folder once then clears it.
    var pendingFolderFilter: String?
}
