import SwiftUI

private let mapCanvasW: CGFloat = 1100
private let mapCanvasH: CGFloat = 1100
private let mapNodeW: CGFloat = 112
private let mapNodeH: CGFloat = 64

struct MapView: View {
    @Environment(AuthSession.self) private var auth
    @State private var items: [Item] = []
    @State private var selectedBookmark: Bookmark?
    @State private var editingNote: Item?
    @State private var isLoading = true
    @State private var mapResetToken = UUID()

    private let api = DominoAPI()

    private var bookmarks: [Bookmark] {
        items.map(BookmarkMapper.toBookmark)
    }

    var body: some View {
        VStack(spacing: 0) {
            mapHeader

            GeometryReader { geo in
                ZStack {
                    DominoColors.bg

                    if isLoading {
                        ProgressView()
                    } else if bookmarks.isEmpty {
                        emptyState
                    } else {
                        MapCanvasView(
                            bookmarks: bookmarks,
                            viewportSize: geo.size,
                            resetToken: mapResetToken,
                            onOpen: openItem
                        )
                    }
                }
            }
        }
        .background(DominoColors.bg)
        .toolbar(.hidden, for: .navigationBar)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $selectedBookmark) { bookmark in
            ItemDetailSheet(
                bookmark: bookmark,
                sessionToken: auth.sessionToken,
                onToggleStar: { Task { await toggleStar(bookmark) } },
                onTogglePin: { Task { await togglePin(bookmark) } },
                onDelete: {
                    Task {
                        await deleteItem(bookmark.id)
                        selectedBookmark = nil
                    }
                }
            )
        }
        // Use item: (not isPresented:) so NoteEditorView always receives a concrete Item
        // at init — @State text is only set once from item?.rawInput.
        .fullScreenCover(item: $editingNote) { note in
            NoteEditorView(
                item: note,
                folders: mapFolders(from: bookmarks),
                onChanged: { item in upsert(item) },
                onDeleted: {
                    items.removeAll { $0.id == note.id }
                    editingNote = nil
                }
            )
            .environment(auth)
        }
    }

    private var mapHeader: some View {
        HStack(alignment: .center) {
            DominoPageTitle(title: "map")
            Spacer()
            Button("reset") {
                mapResetToken = UUID()
            }
            .font(.dominoBody(11, weight: .semibold))
            .foregroundStyle(DominoColors.ink2)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(DominoColors.chipIdle)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(DominoColors.hairline, lineWidth: 1))
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(DominoColors.bg)
    }

    private var emptyState: some View {
        Text("save items to see your topic map")
            .font(.dominoBody(15))
            .foregroundStyle(DominoColors.ink3)
            .padding(.horizontal, 32)
    }

    private func mapFolders(from bookmarks: [Bookmark]) -> [String] {
        var seen: [String] = []
        for bookmark in bookmarks {
            for cat in bookmark.categories where !seen.contains(cat) {
                seen.append(cat)
            }
        }
        return seen
    }

    private func openItem(_ bookmark: Bookmark) {
        if bookmark.kind == .note {
            editingNote = items.first(where: { $0.id == bookmark.id })
        } else {
            selectedBookmark = bookmark
        }
    }

    private func upsert(_ item: Item) {
        if let idx = items.firstIndex(where: { $0.id == item.id }) {
            items[idx] = item
        } else {
            items.insert(item, at: 0)
        }
    }

    private func toggleStar(_ bookmark: Bookmark) async {
        guard let token = auth.sessionToken,
              let idx = items.firstIndex(where: { $0.id == bookmark.id }) else { return }
        let item = items[idx]
        guard let updated = try? await api.patchItem(
            token: token,
            id: item.id,
            patch: ItemPatch(isFavorited: !item.isFavorited)
        ) else { return }
        items[idx] = updated
        if selectedBookmark?.id == bookmark.id {
            selectedBookmark = BookmarkMapper.toBookmark(updated)
        }
    }

    private func togglePin(_ bookmark: Bookmark) async {
        guard let token = auth.sessionToken,
              let idx = items.firstIndex(where: { $0.id == bookmark.id }) else { return }
        let item = items[idx]
        guard let updated = try? await api.patchItem(
            token: token,
            id: item.id,
            patch: ItemPatch(isPinned: !item.isPinned)
        ) else { return }
        items[idx] = updated
        if selectedBookmark?.id == bookmark.id {
            selectedBookmark = BookmarkMapper.toBookmark(updated)
        }
    }

    private func deleteItem(_ id: String) async {
        guard let token = auth.sessionToken else { return }
        try? await api.deleteItem(token: token, id: id)
        items.removeAll { $0.id == id }
    }

    private func load() async {
        guard let token = auth.sessionToken else { return }
        isLoading = items.isEmpty
        items = (try? await api.getItems(token: token, limit: 500)) ?? []
        isLoading = false
    }
}

// MARK: - Canvas (ports web MapCanvas)

private struct MapCanvasView: View {
    let bookmarks: [Bookmark]
    let viewportSize: CGSize
    let resetToken: UUID
    let onOpen: (Bookmark) -> Void

    @State private var hubDelta: [String: CGSize] = [:]
    @State private var nodeDelta: [String: CGSize] = [:]
    @State private var scale: CGFloat = 0.55
    @State private var cam: CGSize = CGSize(width: -100, height: 20)

    /// Pan/pinch origins — write `cam`/`scale` continuously so GestureState
    /// reset can't flash a frame of the pre-gesture camera.
    @State private var panOrigin: CGSize?
    @State private var pinchBaseScale: CGFloat?
    @State private var pinchBaseCam: CGSize?

    /// Set while dragging a hub or node so background pan doesn't steal the gesture.
    @State private var itemDragID: String?
    @State private var hubDragStart: [String: CGSize] = [:]
    @State private var nodeDragStart: [String: CGSize] = [:]
    @State private var didInitialFit = false

    private var folders: [String] {
        var seen: [String] = []
        for bookmark in bookmarks {
            for cat in bookmark.categories where !seen.contains(cat) {
                seen.append(cat)
            }
        }
        return seen
    }

    private var baseHubs: [String: CGPoint] {
        MapLayout.baseHubs(folders: folders)
    }

    private var baseNodes: [String: CGPoint] {
        MapLayout.baseNodes(bookmarks: bookmarks, hubs: baseHubs)
    }

    private var hubs: [String: CGPoint] {
        var out: [String: CGPoint] = [:]
        for cat in folders {
            guard let base = baseHubs[cat] else { continue }
            let d = hubDelta[cat] ?? .zero
            out[cat] = CGPoint(x: base.x + d.width, y: base.y + d.height)
        }
        return out
    }

    private var nodes: [String: CGPoint] {
        var out: [String: CGPoint] = [:]
        for bookmark in bookmarks {
            guard let base = baseNodes[bookmark.id] else { continue }
            let nd = nodeDelta[bookmark.id] ?? .zero
            let cat = bookmark.categories.first
            let hd = cat.flatMap { hubDelta[$0] } ?? .zero
            out[bookmark.id] = CGPoint(
                x: base.x + hd.width + nd.width,
                y: base.y + hd.height + nd.height
            )
        }
        return out
    }

    private var edges: [MapEdge] {
        var out: [MapEdge] = []
        for bookmark in bookmarks {
            guard let node = nodes[bookmark.id] else { continue }
            for (idx, cat) in bookmark.categories.enumerated() {
                guard let hub = hubs[cat] else { continue }
                out.append(MapEdge(
                    id: "\(bookmark.id)@\(cat)",
                    from: hub,
                    to: node,
                    primary: idx == 0
                ))
            }
        }
        return out
    }

    var body: some View {
        ZStack {
            MapDotGridBackground()
                .allowsHitTesting(false)

            canvasLayer
                .drawingGroup()
                .scaleEffect(scale, anchor: .topLeading)
                .offset(cam)
                .transaction { $0.animation = nil }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .overlay(alignment: .bottom) {
            HStack(alignment: .bottom) {
                mapLegend
                Spacer()
                zoomControls
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
        .onAppear { fitIfNeeded() }
        .onChange(of: viewportSize) { _, _ in fitIfNeeded() }
        .onChange(of: bookmarks.count) { _, _ in
            didInitialFit = false
            fitIfNeeded()
        }
        .onChange(of: resetToken) { _, _ in
            resetCanvas()
        }
    }

    private var canvasLayer: some View {
        ZStack(alignment: .topLeading) {
            Color.clear
                .frame(width: mapCanvasW, height: mapCanvasH)
                .contentShape(Rectangle())
                .gesture(viewportPanGesture)
                .simultaneousGesture(viewportPinchGesture)

            ForEach(edges) { edge in
                MapEdgeShape(from: edge.from, to: edge.to)
                    .stroke(
                        edge.primary ? DominoColors.ink.opacity(0.45) : DominoColors.accent.opacity(0.4),
                        style: StrokeStyle(
                            lineWidth: edge.primary ? 1.3 : 1,
                            lineCap: .round,
                            dash: edge.primary ? [] : [3, 5]
                        )
                    )
                    .allowsHitTesting(false)
            }

            ForEach(edges.filter(\.primary)) { edge in
                Circle()
                    .fill(DominoColors.ink.opacity(0.5))
                    .frame(width: 4, height: 4)
                    .position(edge.to)
                    .allowsHitTesting(false)
            }

            ForEach(folders, id: \.self) { cat in
                if let point = hubs[cat] {
                    let count = bookmarks.filter { $0.categories.contains(cat) }.count
                    MapHubView(topic: cat, count: count)
                        .position(point)
                        .highPriorityGesture(hubDragGesture(for: cat))
                }
            }

            ForEach(bookmarks) { bookmark in
                if let point = nodes[bookmark.id] {
                    MapItemNodeView(bookmark: bookmark)
                        .frame(width: mapNodeW, height: mapNodeH)
                        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .position(point)
                        .gesture(nodeTapOrDragGesture(for: bookmark))
                }
            }
        }
        .frame(width: mapCanvasW, height: mapCanvasH)
    }

    private var mapLegend: some View {
        HStack(spacing: 12) {
            legendItem(dashed: false, label: "primary")
            legendItem(dashed: true, label: "also in")
        }
        .font(.dominoBody(10))
        .foregroundStyle(DominoColors.ink3)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(DominoColors.paper.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(DominoColors.hairline.opacity(0.6), lineWidth: 1)
        )
    }

    private func legendItem(dashed: Bool, label: String) -> some View {
        HStack(spacing: 5) {
            Capsule()
                .stroke(DominoColors.ink3.opacity(0.55), style: StrokeStyle(lineWidth: 1.4, dash: dashed ? [3, 4] : []))
                .frame(width: 20, height: 2)
            Text(label)
        }
    }

    private var zoomControls: some View {
        VStack(spacing: 6) {
            VStack(spacing: 0) {
                MapZoomButton(label: "+") { zoom(by: 0.2) }
                Divider().overlay(DominoColors.hairline.opacity(0.6))
                MapZoomButton(label: "−") { zoom(by: -0.2) }
                Divider().overlay(DominoColors.hairline.opacity(0.6))
                MapZoomButton(systemImage: "arrow.up.left.and.arrow.down.right") {
                    fitToContent()
                    didInitialFit = true
                }
            }
            .background(DominoColors.paper.opacity(0.92))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(DominoColors.hairline.opacity(0.6), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.06), radius: 6, y: 2)

            Text("\(Int(scale * 100))%")
                .font(.dominoBody(10))
                .foregroundStyle(DominoColors.ink3)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(DominoColors.paper.opacity(0.85))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(DominoColors.hairline.opacity(0.6), lineWidth: 1)
                )
        }
    }

    // MARK: - Gestures

    private var viewportPanGesture: some Gesture {
        DragGesture(minimumDistance: 1)
            .onChanged { value in
                guard itemDragID == nil else { return }
                if panOrigin == nil { panOrigin = cam }
                let origin = panOrigin ?? cam
                cam = CGSize(
                    width: origin.width + value.translation.width,
                    height: origin.height + value.translation.height
                )
            }
            .onEnded { _ in
                panOrigin = nil
            }
    }

    private var viewportPinchGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                if pinchBaseScale == nil {
                    pinchBaseScale = scale
                    pinchBaseCam = cam
                }
                let baseScale = pinchBaseScale ?? scale
                let baseCam = pinchBaseCam ?? cam
                let next = min(3.0, max(0.25, baseScale * value))
                let center = CGPoint(x: viewportSize.width / 2, y: viewportSize.height / 2)
                let canvasX = (center.x - baseCam.width) / baseScale
                let canvasY = (center.y - baseCam.height) / baseScale
                scale = next
                cam = CGSize(
                    width: center.x - canvasX * next,
                    height: center.y - canvasY * next
                )
            }
            .onEnded { _ in
                pinchBaseScale = nil
                pinchBaseCam = nil
            }
    }

    private func hubDragGesture(for cat: String) -> some Gesture {
        DragGesture(minimumDistance: 2)
            .onChanged { value in
                if itemDragID == nil {
                    itemDragID = "hub:\(cat)"
                    hubDragStart[cat] = hubDelta[cat] ?? .zero
                }
                guard itemDragID == "hub:\(cat)" else { return }
                let start = hubDragStart[cat] ?? .zero
                hubDelta[cat] = CGSize(
                    width: start.width + value.translation.width / scale,
                    height: start.height + value.translation.height / scale
                )
            }
            .onEnded { _ in
                hubDragStart[cat] = nil
                itemDragID = nil
            }
    }

    private func nodeTapOrDragGesture(for bookmark: Bookmark) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let moved = hypot(value.translation.width, value.translation.height)
                if moved < 12 {
                    return
                }
                if itemDragID == nil {
                    itemDragID = "node:\(bookmark.id)"
                    nodeDragStart[bookmark.id] = nodeDelta[bookmark.id] ?? .zero
                }
                guard itemDragID == "node:\(bookmark.id)" else { return }
                let start = nodeDragStart[bookmark.id] ?? .zero
                nodeDelta[bookmark.id] = CGSize(
                    width: start.width + value.translation.width / scale,
                    height: start.height + value.translation.height / scale
                )
            }
            .onEnded { value in
                defer {
                    nodeDragStart[bookmark.id] = nil
                    itemDragID = nil
                }
                let moved = hypot(value.translation.width, value.translation.height)
                if moved < 12 {
                    onOpen(bookmark)
                }
            }
    }

    private func zoom(by delta: CGFloat) {
        let newScale = min(3.0, max(0.25, scale + delta))
        guard newScale != scale else { return }
        zoom(to: newScale)
    }

    private func zoom(to newScale: CGFloat) {
        let center = CGPoint(x: viewportSize.width / 2, y: viewportSize.height / 2)
        let canvasX = (center.x - cam.width) / scale
        let canvasY = (center.y - cam.height) / scale
        scale = newScale
        cam = CGSize(
            width: center.x - canvasX * newScale,
            height: center.y - canvasY * newScale
        )
    }

    private func fitIfNeeded() {
        guard viewportSize.width > 10, viewportSize.height > 10, !bookmarks.isEmpty else { return }
        guard !didInitialFit else { return }
        fitToContent()
        didInitialFit = true
    }

    private func fitToContent() {
        var xs: [CGFloat] = []
        var ys: [CGFloat] = []
        for cat in folders {
            if let h = hubs[cat] { xs.append(h.x); ys.append(h.y) }
        }
        for bookmark in bookmarks {
            if let n = nodes[bookmark.id] { xs.append(n.x); ys.append(n.y) }
        }
        guard !xs.isEmpty, !ys.isEmpty else { return }

        let minX = xs.min()! - 80
        let maxX = xs.max()! + 80
        let minY = ys.min()! - 60
        let maxY = ys.max()! + 60
        let w = maxX - minX
        let h = maxY - minY
        let sx = viewportSize.width / w
        let sy = viewportSize.height / h
        let s = min(sx, sy, 1.0) * 0.92
        scale = s
        cam = CGSize(
            width: (viewportSize.width - w * s) / 2 - minX * s,
            height: (viewportSize.height - h * s) / 2 - minY * s
        )
    }

    private func resetCanvas() {
        hubDelta = [:]
        nodeDelta = [:]
        didInitialFit = false
        fitIfNeeded()
    }
}

// MARK: - Layout (matches web)

private enum MapLayout {
    static func baseHubs(folders: [String]) -> [String: CGPoint] {
        var out: [String: CGPoint] = [:]
        let cx = mapCanvasW / 2
        let cy = mapCanvasH / 2
        for (i, cat) in folders.enumerated() {
            let ring = i < 5 ? 0 : 1
            let inRing = ring == 0 ? min(folders.count, 5) : max(folders.count - 5, 1)
            let idx = ring == 0 ? i : i - 5
            let radius: CGFloat = ring == 0 ? 180 : 380
            let offset = ring == 1 ? Double.pi / Double(inRing) : -Double.pi / 2
            let angle = (Double(idx) / Double(inRing)) * 2 * .pi + offset
            out[cat] = CGPoint(
                x: cx + CGFloat(cos(angle)) * radius,
                y: cy + CGFloat(sin(angle)) * radius
            )
        }
        return out
    }

    static func baseNodes(bookmarks: [Bookmark], hubs: [String: CGPoint]) -> [String: CGPoint] {
        var out: [String: CGPoint] = [:]
        var byCat: [String: [Bookmark]] = [:]
        for bookmark in bookmarks {
            let cat = bookmark.categories.first ?? "misc"
            byCat[cat, default: []].append(bookmark)
        }
        for (cat, list) in byCat {
            guard let hub = hubs[cat] else { continue }
            let n = list.count
            let orbitR = 125 + CGFloat(min(n, 5)) * 4
            for (i, bookmark) in list.enumerated() {
                let baseAngle = (Double(i) / Double(max(n, 1))) * 2 * .pi
                let jitter = (Double(bookmark.id.unicodeScalars.last?.value ?? 0).truncatingRemainder(dividingBy: 11) - 5) / 50
                let angle = baseAngle + jitter
                out[bookmark.id] = CGPoint(
                    x: hub.x + CGFloat(cos(angle)) * orbitR,
                    y: hub.y + CGFloat(sin(angle)) * orbitR
                )
            }
        }
        return out
    }
}

// MARK: - Subviews

private struct MapEdge: Identifiable {
    let id: String
    let from: CGPoint
    let to: CGPoint
    let primary: Bool
}

private struct MapEdgeShape: Shape {
    let from: CGPoint
    let to: CGPoint

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: from)
        let dx = to.x - from.x
        let dy = to.y - from.y
        let mx = (from.x + to.x) / 2
        let my = (from.y + to.y) / 2
        let len = max(hypot(dx, dy), 1)
        let nx = -dy / len * 14
        let ny = dx / len * 14
        path.addQuadCurve(to: to, control: CGPoint(x: mx + nx, y: my + ny))
        return path
    }
}

private struct MapHubView: View {
    let topic: String
    let count: Int

    var body: some View {
        HStack(spacing: 6) {
            Text(topic)
                .font(.dominoDisplay(14, weight: .bold))
                .lineLimit(1)
            Text("\(count)")
                .font(.dominoBody(10, weight: .semibold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.white.opacity(0.18))
                .clipShape(Capsule())
        }
        .foregroundStyle(DominoColors.bg)
        .padding(.horizontal, 14)
        .frame(width: 112, height: 44)
        .background(DominoColors.ink)
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.18), radius: 10, y: 6)
    }
}

private struct MapItemNodeView: View {
    let bookmark: Bookmark

    private var label: String {
        bookmark.title ?? bookmark.domain ?? bookmark.url ?? "untitled"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: kindIcon)
                    .font(.system(size: 9, weight: .semibold))
                Text(bookmark.kind.rawValue)
                    .font(.dominoBody(9, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(0.6)
            }
            .foregroundStyle(DominoColors.ink3)

            Text(label)
                .font(bookmark.kind == .note ? .dominoDisplay(11.5, weight: .bold) : .dominoBody(11.5, weight: .semibold))
                .foregroundStyle(DominoColors.ink)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(width: mapNodeW, alignment: .leading)
        .frame(minHeight: mapNodeH, alignment: .topLeading)
        .background(DominoColors.card(bookmark.colorKey))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.black.opacity(0.04), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.07), radius: 6, y: 3)
    }

    private var kindIcon: String {
        switch bookmark.kind {
        case .link: "link"
        case .note: "note.text"
        case .image: "photo"
        case .pdf: "doc"
        }
    }
}

private struct MapZoomButton: View {
    var label: String?
    var systemImage: String?
    let action: () -> Void

    init(label: String, action: @escaping () -> Void) {
        self.label = label
        self.systemImage = nil
        self.action = action
    }

    init(systemImage: String, action: @escaping () -> Void) {
        self.label = nil
        self.systemImage = systemImage
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Group {
                if let label {
                    Text(label).font(.system(size: 18, weight: .medium))
                } else if let systemImage {
                    Image(systemName: systemImage).font(.system(size: 13, weight: .medium))
                }
            }
            .foregroundStyle(DominoColors.ink2)
            .frame(width: 32, height: 32)
        }
        .buttonStyle(.plain)
    }
}

private struct MapDotGridBackground: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 24
            var x: CGFloat = 0
            while x < size.width {
                var y: CGFloat = 0
                while y < size.height {
                    let rect = CGRect(x: x, y: y, width: 2, height: 2)
                    context.fill(Path(ellipseIn: rect), with: .color(DominoColors.ink4.opacity(0.35)))
                    y += step
                }
                x += step
            }
        }
        .opacity(0.5)
    }
}

#Preview {
    MapView()
        .environment(AuthSession())
        .environment(AppNavigation())
}
