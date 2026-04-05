// api/fleet.js — proxies robotaxitracker.com's Convex backend
const CONVEX_URL = "https://graceful-eel-151.convex.cloud/api/query";
const AUSTIN_ID = "jx72bv82f8vfhp6n2hcd5ynq4h7yz7rn";
const BAY_AREA_ID = "jx737x9sc0v5h2y8snzs52v7b57yzvjk";

function q(path, args) {
  return fetch(CONVEX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: path, args: args || {} })
  }).then(function(r) { return r.json(); });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    var results = await Promise.all([
      q("queries/fleet:getHomepageData", {
        provider: "tesla", sortBy: "recently_discovered", tripLimit: 6, vehicleLimit: 8
      }),
      q("queries/vehicles:getCybercabsByRegion", {}),
      q("queries/fleet:getFleetGrowthData", { provider: "tesla" })
    ]);

    var fleet = results[0].value || results[0];
    var cybercabData = results[1].value || results[1];
    var growthData = results[2].value || results[2];

    var testRegionCount = 0;
    if (cybercabData && cybercabData.regions) {
      cybercabData.regions.forEach(function(region) {
        if (region.isTestRegion && region.cybercabs) {
          testRegionCount += region.cybercabs.length;
        }
      });
    }

    // Count per-city from the COMPLETE vehicle list
    var austinCount = 0;
    var bayAreaCount = 0;
    if (growthData && Array.isArray(growthData.vehicles)) {
      growthData.vehicles.forEach(function(v) {
        if (v.service_area_id === AUSTIN_ID) austinCount++;
        else if (v.service_area_id === BAY_AREA_ID) bayAreaCount++;
      });
    }

    var ts = fleet.tripStats || {};

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
