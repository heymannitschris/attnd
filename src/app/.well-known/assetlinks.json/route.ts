export const dynamic = "force-static";

// Android App Links (com.ninjaworld.attndr).
// UPLOAD key SHA-256 (keystore /home/box/attnd-backup/android/upload-keystore.jks, alias "upload").
const DEFAULT_FINGERPRINTS = [
  "DB:A8:2D:28:45:E2:F7:A0:D4:3A:6D:94:73:CC:E5:D1:73:CD:BC:D8:CB:6E:54:B6:91:96:77:EC:C0:73:9A:6A", // upload key
  "D3:56:91:E6:A7:32:1A:B9:65:FD:20:D6:B4:02:57:2F:AF:DC:6D:C7:17:55:89:FB:75:0E:69:6F:20:6B:05:7E", // Play App Signing key
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
