// ─────────────────────────────────────────────────────────
// FILE: api/fleet.js
// Vercel Serverless Function — proxies Convex APIs
// Pulls total + per-city fleet counts from robotaxitracker.com's backend
// ─────────────────────────────────────────────────────────

const CONVEX_URL = "https://graceful-eel-151.convex.cloud/api/query";

// Service area IDs from robotaxitracker's Convex database
const AUSTIN_AREA_ID = "jx72bv82f8vfhp6n2hcd5ynq4h7yz7rn";
const BAY_AREA_ID = "jx737x9sc0v5h2y8snzs52v7b57yzvjk";

function convexQuery(path, args) {
  return fetch(CONVEX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: path, args: args || {} })
  }).then(function (r) { return r.json(); });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Fetch all three data sources in parallel
    var results = await Promise.all([
      convexQuery("queries/fleet:getHomepageData", {
        provider: "tesla",
        sortBy: "recently_discovered",
        tripLimit: 6,
        vehicleLimit: 8
      }),
      convexQuery("queries/vehicles:getCybercabsByRegion", {}),
      convexQuery("queries/fleet:getFleetStats", { provider: "tesla" })
    ]);

    var fleet = results[0].value || results[0];
    var cybercabData = results[1].value || results[1];
    var fleetStats = results[2].value || results[2];

    // Count test-region cybercabs (to subtract from total)
    var testRegionCount = 0;
    if (cybercabData && cybercabData.regions) {
      cybercabData.regions.forEach(function (region) {
        if (region.isTestRegion && region.cybercabs) {
          testRegionCount += region.cybercabs.length;
        }
      });
    }

    var ts = fleet.tripStats || {};

    // Count vehicles per city from fleetStats
    var austinCount = null;
    var bayAreaCount = null;

    if (fleetStats && Array.isArray(fleetStats.vehicles)) {
      var austin = 0;
      var bayArea = 0;
      var other = 0;

      fleetStats.vehicles.forEach(function (v) {
        if (v.serviceAreaId === AUSTIN_AREA_ID) {
          austin++;
        } else if (v.serviceAreaId === BAY_AREA_ID) {
          bayArea++;
        } else {
          other++;
        }
      });

      var sampleSize = fleetStats.vehicles.length;
      var totalVehicles = fleetStats.totalVehicles || fleet.totalFleetCount;

      if (sampleSize >= totalVehicles * 0.9) {
        // Sample covers 90%+ of fleet — use direct counts
        austinCount = austin;
        bayAreaCount = bayArea;
      } else if (sampleSize > 0) {
        // Partial sample — extrapolate from ratio
        var knownTotal = austin + bayArea;
        if (knownTotal > 0) {
          var adjustedTotal = totalVehicles - testRegionCount;
          austinCount = Math.round((austin / knownTotal) * adjustedTotal);
          bayAreaCount = Math.round((bayArea / knownTotal) * adjustedTotal);
        }
      }
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      fleet: {
        totalFleetCount: fleet.totalFleetCount - testRegionCount,
        totalFleetCountRaw: fleet.totalFleetCount,
        testRegionCount: testRegionCount,
        totalWithTest: fleet.totalVehiclesCountWithTest,
        cybercabCount: cybercabData.totalCybercabs,
        unsupervisedCount: fleet.unsupervisedPassengerCount,
        recentVehicles30d: fleet.recentVehiclesCount30d,
        austinCount: austinCount,
        bayAreaCount: bayAreaCount,
        totalTrips: ts.totalTrips,
        totalMiles: ts.totalMiles,
        avgFare: ts.avgPrice,
        avgTripMiles: ts.avgMiles,
        totalContributors: ts.totalContributors
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
