export const dynamic = "force-static";

// Android App Links (com.ninjaworld.attndr).
// UPLOAD key SHA-256 (keystore /home/box/attnd-backup/android/upload-keystore.jks, alias "upload").
// TODO: add the Play App Signing key SHA-256 (Play Console → Setup → App signing) here
// or via ANDROID_APP_SHA256_CERT_FINGERPRINT (comma-separated) once the Play app exists.
const DEFAULT_FINGERPRINTS = [
  "DB:A8:2D:28:45:E2:F7:A0:D4:3A:6D:94:73:CC:E5:D1:73:CD:BC:D8:CB:6E:54:B6:91:96:77:EC:C0:73:9A:6A", // upload key
  // "PLAY_APP_SIGNING_SHA256_PLACEHOLDER", // Play App Signing key
];

export function GET() {
  const fromEnv = (process.env.ANDROID_APP_SHA256_CERT_FINGERPRINT || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const fingerprints = Array.from(new Set([...DEFAULT_FINGERPRINTS, ...fromEnv]));
  const details = [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: process.env.ANDROID_APP_PACKAGE || "com.ninjaworld.attndr",
      sha256_cert_fingerprints: fingerprints,
    },
  }];

  return Response.json(details, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
