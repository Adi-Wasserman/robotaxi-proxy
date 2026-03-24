// ─────────────────────────────────────────────────────────
// FILE: api/fleet.js
// Vercel Serverless Function — proxies Convex + wait-time APIs
// Deploy: push to GitHub → connect to Vercel → done
// ─────────────────────────────────────────────────────────

const CONVEX_URL = "https://graceful-eel-151.convex.cloud/api/query";
const WAIT_TIME_URL = "https://robotaxitracker.com/api/wait-time/unified?provider=tesla";

module.exports = async function handler(req, res) {
  // Allow any origin (your artifact, localhost, your domain)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Fetch both in parallel
    const [fleetRes, waitRes] = await Promise.all([
      fetch(CONVEX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "queries/fleet:getHomepageData",
          args: {
            provider: "tesla",
            sortBy: "recently_discovered",
            tripLimit: 6,
            vehicleLimit: 8,
          },
        }),
      }),
      fetch(WAIT_TIME_URL),
    ]);

    const fleetJson = await fleetRes.json();
    const waitJson = await waitRes.json();

    // Extract the fleet data from Convex response
    const fleet = fleetJson.value || fleetJson;

    // Build clean response
    const response = {
      timestamp: new Date().toISOString(),
      fleet: {
        totalFleetCount: fleet.totalFleetCount,
        totalWithTest: fleet.totalVehiclesCountWithTest,
        cybercabCount: fleet.cybercabCount,
        unsupervisedCount: fleet.unsupervisedPassengerCount,
        recentVehicles30d: fleet.recentVehiclesCount30d,
        tripStats: fleet.tripStats
          ? {
              totalTrips: fleet.tripStats.totalTrips,
              totalMiles: fleet.tripStats.totalMiles,
              avgFare: fleet.tripStats.avgPrice,
              avgTripMiles: fleet.tripStats.avgMiles,
              totalContributors: fleet.tripStats.totalContributors,
            }
          : null,
      },
      waitTimes: waitJson.data || waitJson,
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
