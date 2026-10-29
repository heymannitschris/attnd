const association = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: ["5W74MHPPN9.com.ninjaworld.attndr"],
        components: [
          { "/": "/*", comment: "Open Attnd web and affiliate links in the iOS app." },
        ],
      },
    ],
  },
};

export const dynamic = "force-static";

export function GET() {
  return Response.json(association, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
