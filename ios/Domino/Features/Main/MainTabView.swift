import SwiftUI

struct MainTabView: View {
    @AppStorage(AppConfig.firstRunOnboardingKey) private var firstRunComplete = false
    @State private var nav = AppNavigation()

    var body: some View {
        @Bindable var nav = nav
        ZStack {
        TabView(selection: $nav.selectedTab) {
            DashboardView()
                .tabItem { Label("saved", systemImage: "bookmark") }
                .tag(0)

            MapView()
                .tabItem { Label("map", systemImage: "point.3.connected.trianglepath.dotted") }
                .tag(1)

            ChatView()
                .tabItem { Label("ask", systemImage: "magnifyingglass") }
                .tag(2)

            DiscoverView()
                .tabItem { Label("discover", systemImage: "safari") }
                .tag(3)
        }
        .tint(DominoColors.accent)
        .environment(nav)

            if !firstRunComplete {
                FirstRunOnboardingView {
                    withAnimation(.easeInOut(duration: 0.32)) {
                        firstRunComplete = true
                    }
                }
                .transition(.opacity)
                .zIndex(1)
            }
        }
    }
}

#Preview {
    MainTabView()
        .environment(AuthSession())
}
