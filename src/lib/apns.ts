import { connect } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

type ApnsPayload = { title: string; body: string; href?: string };

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function providerToken() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const rawKey = process.env.APNS_PRIVATE_KEY;
  if (!keyId || !teamId || !rawKey) return null;
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const content = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(content), { key: createPrivateKey(rawKey.replace(/\\n/g, "\n")), dsaEncoding: "ieee-p1363" });
  return `${content}.${base64url(signature)}`;
}

export async function sendApns(token: string, environment: "development" | "production", payload: ApnsPayload) {
  const authorization = providerToken();
  const topic = process.env.APNS_BUNDLE_ID;
  if (!authorization || !topic) return { sent: false as const, reason: "APNs is not configured" };
  const origin = environment === "development" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  return new Promise<{ sent: boolean; reason?: string }>((resolve) => {
    const client = connect(origin);
    client.once("error", (error) => resolve({ sent: false, reason: error.message }));
    const request = client.request({
      ":method": "POST", ":path": `/3/device/${token}`,
      authorization: `bearer ${authorization}`, "apns-topic": topic, "apns-push-type": "alert", "apns-priority": "10",
    });
    let responseBody = "";
    let status = 0;
    request.on("response", (headers) => { status = Number(headers[":status"] || 0); });
    request.on("data", (chunk) => { responseBody += chunk; });
    request.on("end", () => { client.close(); resolve(status === 200 ? { sent: true } : { sent: false, reason: responseBody || `APNs ${status}` }); });
    request.end(JSON.stringify({ aps: { alert: { title: payload.title, body: payload.body }, sound: "default" }, href: payload.href }));
  });
}
