import SwiftUI
import UIKit
import UserNotifications

extension Notification.Name {
    static let attndPushToken = Notification.Name("attndPushToken")
    static let attndOpenPushURL = Notification.Name("attndOpenPushURL")
    static let attndOpenDeepLink = Notification.Name("attndOpenDeepLink")
}

final class AppDelegate: NSObject, UIApplicationDelegate, @preconcurrency UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: "attndPushToken")
        NotificationCenter.default.post(name: .attndPushToken, object: token)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .attndPushToken, object: "")
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        if let href = response.notification.request.content.userInfo["href"] as? String,
           let url = URL(string: href, relativeTo: URL(string: "https://www.attnd.space"))?.absoluteURL,
           url.host == "www.attnd.space" || url.host == "attnd.space" {
            UserDefaults.standard.set(url.absoluteString, forKey: "attndPendingPushURL")
            NotificationCenter.default.post(name: .attndOpenPushURL, object: url)
        }
        completionHandler()
    }
}

@main
struct EventPlatformApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
