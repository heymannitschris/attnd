import SwiftUI

struct ContentView: View {
    @State private var deepLinkURL: URL?

    var body: some View {
        EventWebView(deepLinkURL: deepLinkURL)
            .background(Color.black)
            .ignoresSafeArea()
            .preferredColorScheme(.dark)
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                guard let url = activity.webpageURL,
                      url.host == "www.attnd.space" || url.host == "attnd.space" else { return }
                deepLinkURL = url
            }
            .onOpenURL { url in
                guard url.scheme == "com.ninjaworld.attndr",
                      url.host == "open",
                      let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                      let targetValue = components.queryItems?.first(where: { $0.name == "target" })?.value,
                      let targetURL = URL(string: targetValue),
                      targetURL.scheme == "https",
                      targetURL.host == "www.attnd.space" || targetURL.host == "attnd.space" else { return }
                deepLinkURL = targetURL
            }
    }
}
