export const dynamic = "force-static";

export function GET() {
  const fingerprints = (process.env.ANDROID_APP_SHA256_CERT_FINGERPRINT || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const details = fingerprints.length
    ? [{
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: process.env.ANDROID_APP_PACKAGE || "com.ninjaworld.attndr",
          sha256_cert_fingerprints: fingerprints,
        },
      }]
    : [];

  return Response.json(details, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
