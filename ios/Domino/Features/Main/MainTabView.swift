import SwiftUI

struct MainTabView: View {
    @State private var nav = AppNavigation()

    var body: some View {
        @Bindable var nav = nav
        TabView(selection: $nav.selectedTab) {
            DashboardView()
                .tabItem { Label("saved", systemImage: "bookmark") }
                .tag(0)

            MapView()
                .tabItem { Label("map", systemImage: "point.3.connected.trianglepath.dotted") }
                .tag(1)

            DiscoverView()
                .tabItem { Label("discover", systemImage: "safari") }
                .tag(2)
        }
        .tint(DominoColors.accent)
        .environment(nav)
    }
}

#Preview {
    MainTabView()
        .environment(AuthSession())
}
