import SwiftUI
import UIKit
import CoreText

enum DominoFonts {
    static let figtree = "Figtree"
    static let newsreader = "Newsreader"
    /// PostScript names — reliable for Font.custom / UIFont(name:)
    static let basteleurBold = "Basteleur-Bold"
    static let basteleurMoonlight = "Basteleur-Moonlight"

    private static let bundledFiles = [
        "Figtree-Variable",
        "Newsreader-Variable",
        "Basteleur-Bold",
        "Basteleur-Moonlight",
    ]

    static func register() {
        for name in bundledFiles {
            // Copied flat into the app bundle (not under Fonts/)
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else {
                print("domino: missing font \(name).ttf")
                continue
            }
            var error: Unmanaged<CFError>?
            if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
                let message = error?.takeRetainedValue().localizedDescription ?? "unknown"
                if !message.lowercased().contains("already registered") {
                    print("domino: font register failed for \(name): \(message)")
                }
            }
        }
        applyChromeTypography()
    }

    /// Logo + tab / nav chrome use Basteleur.
    static func applyChromeTypography() {
        let logo = UIFont(name: basteleurBold, size: 17)
            ?? .systemFont(ofSize: 17, weight: .bold)
        let largeLogo = UIFont(name: basteleurBold, size: 32)
            ?? .systemFont(ofSize: 32, weight: .bold)
        let tab = UIFont(name: newsreader, size: 10)
            ?? UIFont(name: basteleurBold, size: 10)
            ?? .systemFont(ofSize: 10, weight: .semibold)

        let nav = UINavigationBarAppearance()
        nav.configureWithTransparentBackground()
        nav.backgroundColor = UIColor(DominoColors.bg)
        nav.titleTextAttributes = [
            .font: logo,
            .foregroundColor: UIColor(DominoColors.ink),
        ]
        nav.largeTitleTextAttributes = [
            .font: largeLogo,
            .foregroundColor: UIColor(DominoColors.ink),
        ]
        let bar = UINavigationBar.appearance()
        bar.standardAppearance = nav
        bar.scrollEdgeAppearance = nav
        bar.compactAppearance = nav

        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithDefaultBackground()
        let item = tabAppearance.stackedLayoutAppearance
        item.normal.titleTextAttributes = [
            .font: tab,
            .foregroundColor: UIColor(DominoColors.ink4),
        ]
        item.selected.titleTextAttributes = [
            .font: tab,
            .foregroundColor: UIColor(DominoColors.accent),
        ]
        tabAppearance.inlineLayoutAppearance = item
        tabAppearance.compactInlineLayoutAppearance = item

        let tabBar = UITabBar.appearance()
        tabBar.standardAppearance = tabAppearance
        tabBar.scrollEdgeAppearance = tabAppearance
    }
}

extension Font {
    static func dominoBody(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(DominoFonts.figtree, size: size).weight(weight)
    }

    static func dominoDisplay(_ size: CGFloat, weight: Font.Weight = .black) -> Font {
        .custom(DominoFonts.newsreader, size: size).weight(weight)
    }

    /// Brand wordmark / screen titles (Basteleur Bold).
    static func dominoLogo(_ size: CGFloat) -> Font {
        .custom(DominoFonts.basteleurBold, size: size)
    }

    /// Lighter display cut for secondary chrome.
    static func dominoLogoSoft(_ size: CGFloat) -> Font {
        .custom(DominoFonts.basteleurMoonlight, size: size)
    }

    static func dominoCaption(_ size: CGFloat = 12) -> Font {
        .custom(DominoFonts.figtree, size: size)
    }
}

struct DominoFontModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.font(.dominoBody(16))
    }
}

extension View {
    func dominoFont() -> some View {
        modifier(DominoFontModifier())
    }
}
