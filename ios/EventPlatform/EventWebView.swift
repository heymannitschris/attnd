import SwiftUI
import WebKit
import CoreLocation
import AVFoundation
import UserNotifications
import AuthenticationServices

struct EventWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Keep WebKit's complete Safari user agent so Stripe can detect a
        // supported browser. Appending the app name still lets the web UI
        // identify the native shell without replacing the browser identity.
        configuration.applicationNameForUserAgent = "EventPlatform-iOS/1.0"
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(context.coordinator, name: "attndLocationPermission")
        configuration.userContentController.add(context.coordinator, name: "attndCameraPermission")
        configuration.userContentController.add(context.coordinator, name: "attndTorch")
        configuration.userContentController.add(context.coordinator, name: "attndNotificationPermission")
        configuration.userContentController.add(context.coordinator, name: "attndSocialAuth")
        configuration.userContentController.add(context.coordinator, name: "attndCheckout")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true

        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = .white
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
        context.coordinator.webView = webView
        context.coordinator.startObservingPushTokens()

        let pendingDeepLink = DeepLinkRouter.takePending().flatMap { AppEnvironment.isAppURL($0) ? $0 : nil }
        guard let url = pendingDeepLink ?? AppEnvironment.appStartURL else {
            webView.loadHTMLString(AppEnvironment.configurationErrorHTML, baseURL: nil)
            return webView
        }
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding, @preconcurrency CLLocationManagerDelegate {
        weak var webView: WKWebView?
        private var socialAuthSession: ASWebAuthenticationSession?
        private lazy var locationManager: CLLocationManager = {
            let manager = CLLocationManager()
            manager.delegate = self
            manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
            return manager
        }()

        deinit { NotificationCenter.default.removeObserver(self) }

        func startObservingPushTokens() {
            NotificationCenter.default.addObserver(self, selector: #selector(receivePushToken(_:)), name: .attndPushToken, object: nil)
            NotificationCenter.default.addObserver(self, selector: #selector(openPushURL(_:)), name: .attndOpenPushURL, object: nil)
            NotificationCenter.default.addObserver(self, selector: #selector(openDeepLink(_:)), name: .attndOpenDeepLink, object: nil)
            if let token = UserDefaults.standard.string(forKey: "attndPushToken"), !token.isEmpty { sendPushToken(token) }
            if let rawURL = UserDefaults.standard.string(forKey: "attndPendingPushURL"), let url = URL(string: rawURL) {
                UserDefaults.standard.removeObject(forKey: "attndPendingPushURL")
                webView?.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
            }
        }

        @objc private func receivePushToken(_ notification: Notification) {
            guard let token = notification.object as? String, !token.isEmpty else { return }
            sendPushToken(token)
        }

        @objc private func openDeepLink(_ notification: Notification) {
            guard let url = DeepLinkRouter.takePending() ?? (notification.object as? URL),
                  AppEnvironment.isAppURL(url) else { return }
            webView?.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        }

        @objc private func openPushURL(_ notification: Notification) {
            guard let url = notification.object as? URL, AppEnvironment.isAppURL(url) else { return }
            UserDefaults.standard.removeObject(forKey: "attndPendingPushURL")
            webView?.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        }

        private func sendPushToken(_ token: String) {
#if DEBUG
            let environment = "development"
#else
            let environment = "production"
#endif
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('attnd-native-push-token',{detail:{token:'\(token)',environment:'\(environment)'}}))")
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "attndCheckout" {
                openCheckout(message.body)
                return
            }
            if message.name == "attndSocialAuth" {
                beginSocialAuth(message.body)
                return
            }
            if message.name == "attndCameraPermission" {
                requestCameraPermission()
                return
            }
            if message.name == "attndTorch" {
                let enabled = (message.body as? [String: Any])?["enabled"] as? Bool ?? false
                setTorch(enabled)
                return
            }
            if message.name == "attndNotificationPermission" {
                let action = (message.body as? [String: Any])?["action"] as? String ?? "request"
                if action == "getToken" {
                    replayOrRegisterPushToken()
                } else {
                    requestNotificationPermission()
                }
                return
            }
            guard message.name == "attndLocationPermission" else { return }
            switch locationManager.authorizationStatus {
            case .notDetermined:
                locationManager.requestWhenInUseAuthorization()
            case .authorizedAlways, .authorizedWhenInUse:
                locationManager.requestLocation()
            case .denied, .restricted:
                sendLocationError("denied")
            @unknown default:
                sendLocationError("unavailable")
            }
        }

        private func openCheckout(_ body: Any) {
            guard let rawURL = (body as? [String: Any])?["url"] as? String,
                  let url = URL(string: rawURL),
                  url.scheme == "https",
                  let host = url.host?.lowercased(),
                  host == "stripe.com" || host.hasSuffix(".stripe.com") else { return }
            UIApplication.shared.open(url)
        }

        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            webView?.window ?? UIWindow()
        }

        private func beginSocialAuth(_ body: Any) {
            let callback = "com.ninjaworld.attndr://auth/callback"
            guard let rawURL = (body as? [String: Any])?["url"] as? String,
                  let url = URL(string: rawURL),
                  url.scheme == "https",
                  url.host == "jcakijceipjupbhanpij.supabase.co",
                  url.path == "/auth/v1/authorize",
                  URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "redirect_to" })?.value == callback else {
                sendSocialAuthResult(error: "Sign-in could not be started securely.")
                return
            }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "com.ninjaworld.attndr") { [weak self] callbackURL, error in
                self?.socialAuthSession = nil
                if let callbackURL {
                    self?.sendSocialAuthResult(callbackURL: callbackURL)
                } else {
                    let wasCancelled = (error as NSError?)?.code == ASWebAuthenticationSessionError.canceledLogin.rawValue
                    self?.sendSocialAuthResult(error: wasCancelled ? "Sign-in cancelled." : "Sign-in could not be completed.")
                }
            }
            session.presentationContextProvider = self
            socialAuthSession = session
            if !session.start() {
                socialAuthSession = nil
                sendSocialAuthResult(error: "Sign-in could not be opened.")
            }
        }

        private func sendSocialAuthResult(callbackURL: URL? = nil, error: String? = nil) {
            let detail = ["callbackURL": callbackURL?.absoluteString ?? "", "error": error ?? ""]
            guard let data = try? JSONSerialization.data(withJSONObject: detail),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('attnd-native-social-auth',{detail:\(json)}))")
        }

        func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
            switch manager.authorizationStatus {
            case .authorizedAlways, .authorizedWhenInUse:
                manager.requestLocation()
            case .denied, .restricted:
                sendLocationError("denied")
            default:
                break
            }
        }

        func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
            guard let coordinate = locations.last?.coordinate else {
                sendLocationError("unavailable")
                return
            }
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('attnd-native-location',{detail:{latitude:\(coordinate.latitude),longitude:\(coordinate.longitude)}}))")
        }

        func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
            sendLocationError("unavailable")
        }

        private func sendLocationError(_ value: String) {
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('attnd-native-location',{detail:{error:'\(value)'}}))")
        }

        private func requestCameraPermission() {
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized:
                sendCameraPermission(true)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                    DispatchQueue.main.async { self?.sendCameraPermission(granted) }
                }
            case .denied, .restricted:
                sendCameraPermission(false)
            @unknown default:
                sendCameraPermission(false)
            }
        }

        private func sendCameraPermission(_ granted: Bool) {
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('attnd-native-camera',{detail:{granted:\(granted)}}))")
        }

        private func requestNotificationPermission() {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { [weak self] granted, _ in
                DispatchQueue.main.async {
                    self?.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('attnd-native-notifications',{detail:{granted:\(granted)}}))")
                    if granted { self?.replayOrRegisterPushToken() }
                }
            }
        }

        private func replayOrRegisterPushToken() {
            if let token = UserDefaults.standard.string(forKey: "attndPushToken"), !token.isEmpty {
                sendPushToken(token)
                return
            }
            UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
                let granted = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional || settings.authorizationStatus == .ephemeral
                DispatchQueue.main.async {
                    self?.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('attnd-native-notifications',{detail:{granted:\(granted),registering:\(granted)}}))")
                    if granted { UIApplication.shared.registerForRemoteNotifications() }
                }
            }
        }

        private func setTorch(_ enabled: Bool) {
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back), device.hasTorch else {
                sendTorchState(false, error: true)
                return
            }
            do {
                try device.lockForConfiguration()
                if enabled {
                    try device.setTorchModeOn(level: AVCaptureDevice.maxAvailableTorchLevel)
                } else {
                    device.torchMode = .off
                }
                device.unlockForConfiguration()
                sendTorchState(enabled, error: false)
            } catch {
                sendTorchState(false, error: true)
            }
        }

        private func sendTorchState(_ enabled: Bool, error: Bool) {
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('attnd-native-torch',{detail:{enabled:\(enabled),error:\(error)}}))")
        }

        @objc func refresh(_ control: UIRefreshControl) {
            webView?.reload()
            control.endRefreshing()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @MainActor @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            // Stripe Checkout runs in a cross-origin iframe. Only top-level links
            // should leave the app; iframe navigation must remain in WKWebView.
            if navigationAction.targetFrame?.isMainFrame == false {
                decisionHandler(.allow)
                return
            }

            let destinationHost = url.host?.lowercased() ?? ""
            let isStripeDestination = destinationHost == "stripe.com" || destinationHost.hasSuffix(".stripe.com")
            if isStripeDestination {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            if navigationAction.targetFrame == nil || !AppEnvironment.isAppURL(url) {
                if ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }
            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation?,
            withError error: Error
        ) {
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            webView.loadHTMLString(AppEnvironment.offlineHTML, baseURL: AppEnvironment.startURL)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
            // Discover owns its horizontal card gestures. Create Event keeps form
            // state in the current document, so an edge swipe must never leave it.
            let protectedPaths = ["/discover", "/create"]
            webView.allowsBackForwardNavigationGestures = !protectedPaths.contains(webView.url?.path ?? "")
            webView.scrollView.refreshControl?.isEnabled = webView.url?.path != "/create"
            if let token = UserDefaults.standard.string(forKey: "attndPushToken"), !token.isEmpty { sendPushToken(token) }
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url {
                UIApplication.shared.open(url)
            }
            return nil
        }

        @available(iOS 15.0, *)
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @MainActor @escaping (WKPermissionDecision) -> Void
        ) {
            if let url = webView.url, AppEnvironment.isAppURL(url) {
                decisionHandler(.grant)
            } else {
                decisionHandler(.prompt)
            }
        }
    }
}

private enum AppEnvironment {
    static var startURL: URL? {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "AppServerURL") as? String,
              !rawValue.contains("APP_SERVER_URL"),
              let url = URL(string: rawValue),
              url.host != nil else { return nil }
        return url
    }

    static var appStartURL: URL? {
        startURL?.appending(path: "onboarding")
    }

    static func isAppURL(_ url: URL) -> Bool {
        guard let appHost = startURL?.host else { return false }
        return url.host == appHost || (appHost == "www.attnd.space" && url.host == "attnd.space")
    }

    static let configurationErrorHTML = page(
        title: "App URL fehlt",
        message: "Trage vor dem Build die öffentliche App-URL in der Build-Einstellung APP_SERVER_URL ein."
    )

    static let offlineHTML = page(
        title: "Keine Verbindung",
        message: "Die Event-App konnte nicht geladen werden. Prüfe deine Internetverbindung und öffne die App erneut."
    )

    private static func page(title: String, message: String) -> String {
        """
        <!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <style>html,body{height:100%;margin:0;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif}body{display:grid;place-items:center;padding:28px;box-sizing:border-box;text-align:center}main{max-width:340px}i{display:grid;place-items:center;width:64px;height:64px;margin:0 auto 22px;border:1px solid #ffffff;border-radius:50%;color:#ffffff;font-style:normal;font-size:30px}h1{font-size:24px;margin:0 0 12px}p{color:#aaa;line-height:1.5;margin:0}</style>
        <body><main><i>!</i><h1>\(title)</h1><p>\(message)</p></main></body></html>
        """
    }
}
