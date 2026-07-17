import SwiftUI

struct FoldersView: View {
    @Environment(AuthSession.self) private var auth
    @Environment(AppNavigation.self) private var nav
    @State private var items: [Item] = []
    @State private var isLoading = true

    private let api = DominoAPI()

    private var folders: [(name: String, count: Int)] {
        Dictionary(grouping: items.compactMap(\.topic).filter { !$0.isEmpty }, by: { $0 })
            .map { (name: $0.key, count: $0.value.count) }
            .sorted { $0.count > $1.count }
    }

    /// Lightweight “tags” from topics that look like tags or short labels.
    private var tags: [String] {
        folders
            .map(\.name)
            .filter { $0.count <= 18 }
            .prefix(10)
            .map { $0.lowercased().replacingOccurrences(of: " ", with: "") }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    DominoPageTitle(title: "Folders")
                        .padding(.horizontal, 20)

                    if isLoading {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    } else if folders.isEmpty {
                        VStack(spacing: 10) {
                            Text("No folders yet")
                                .font(.dominoDisplay(22, weight: .bold))
                            Text("As you save notes, topics show up here.")
                                .font(.dominoBody(15))
                                .foregroundStyle(DominoColors.ink3)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 48)
                        .padding(.horizontal, 20)
                    } else {
                        LazyVGrid(
                            columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
                            spacing: 12
                        ) {
                            ForEach(folders, id: \.name) { folder in
                                Button {
                                    nav.pendingFolderFilter = folder.name
                                    nav.selectedTab = 0
                                } label: {
                                    DominoFolderCard(name: folder.name, count: folder.count)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 20)

                        if !tags.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("TAGS")
                                    .font(.dominoBody(12, weight: .semibold))
                                    .foregroundStyle(DominoColors.ink4)
                                    .tracking(1)

                                FlowLayout(spacing: 8) {
                                    ForEach(tags, id: \.self) { tag in
                                        Button {
                                            nav.pendingFolderFilter = folders.first(where: {
                                                $0.name.lowercased().replacingOccurrences(of: " ", with: "") == tag
                                            })?.name
                                            nav.selectedTab = 0
                                        } label: {
                                            DominoTagChip(tag: tag)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.top, 8)
                        }
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 100)
            }
            .background(DominoColors.bg)
            .toolbar(.hidden, for: .navigationBar)
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        guard let token = auth.sessionToken else { return }
        isLoading = items.isEmpty
        items = (try? await api.getItems(token: token, limit: 500)) ?? items
        isLoading = false
    }
}

/// Minimal wrapping layout for tag chips.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, frame) in result.frames.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, frames: [CGRect]) {
        let maxWidth = proposal.width ?? .infinity
        var frames: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var width: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            width = max(width, x - spacing)
        }

        return (CGSize(width: width, height: y + rowHeight), frames)
    }
}

#Preview {
    FoldersView()
        .environment(AuthSession())
        .environment(AppNavigation())
}
