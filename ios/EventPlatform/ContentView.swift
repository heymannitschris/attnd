import SwiftUI

/// Single place that receives incoming universal links / app-scheme links.
/// The URL is stored as "pending" until the WKWebView coordinator consumes it,
/// so a link that arrives before the web view exists (cold launch) or while the
/// start page is still loading is never lost or overridden by /onboarding.
enum DeepLinkRouter {
    static let pendingKey = "attndPendingDeepLinkURL"

    static func normalize(_ url: URL) -> URL? {
        let attndHosts: Set<String> = ["www.attnd.space", "attnd.space"]
        if url.scheme == "https", let host = url.host?.lowercased(), attndHosts.contains(host) {
            return url
        }
        guard url.scheme?.lowercased() == "com.ninjaworld.attndr" else { return nil }
        // com.ninjaworld.attndr://open?target=https://www.attnd.space/events/x
        if url.host == "open",
           let target = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "target" })?.value,
           let targetURL = URL(string: target),
           targetURL.scheme == "https",
           let host = targetURL.host?.lowercased(), attndHosts.contains(host) {
            return targetURL
        }
        // com.ninjaworld.attndr://events/<slug>  ->  https://www.attnd.space/events/<slug>
        guard let host = url.host, !host.isEmpty, host != "auth", host != "open" else { return nil }
        var components = URLComponents()
        components.scheme = "https"
        components.host = "www.attnd.space"
        components.path = "/" + host + url.path
        components.query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.query
        return components.url
    }

    static func handle(_ url: URL) {
        guard let target = normalize(url) else { return }
        UserDefaults.standard.set(target.absoluteString, forKey: pendingKey)
        NotificationCenter.default.post(name: .attndOpenDeepLink, object: target)
    }

    static func takePending() -> URL? {
        guard let raw = UserDefaults.standard.string(forKey: pendingKey) else { return nil }
        UserDefaults.standard.removeObject(forKey: pendingKey)
        return URL(string: raw)
    }
}

struct ContentView: View {
    var body: some View {
        EventWebView()
            .background(Color.black)
            .ignoresSafeArea()
            .preferredColorScheme(.dark)
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                if let url = activity.webpageURL { DeepLinkRouter.handle(url) }
            }
            .onOpenURL { url in DeepLinkRouter.handle(url) }
    }
}
