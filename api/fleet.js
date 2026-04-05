// ─────────────────────────────────────────────────────────
// FILE: api/fleet.js
// Vercel Serverless Function — proxies Convex APIs
// Pulls total + per-city fleet counts from robotaxitracker.com's backend
// Deploy: push to GitHub → auto-deploys on Vercel
// ─────────────────────────────────────────────────────────

const CONVEX_URL = "https://graceful-eel-151.convex.cloud/api/query";

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
    // ── Core fleet data (existing, known to work) ──
    var results = await Promise.all([
      convexQuery("queries/fleet:getHomepageData", {
        provider: "tesla",
        sortBy: "recently_discovered",
        tripLimit: 6,
        vehicleLimit: 8
      }),
      convexQuery("queries/vehicles:getCybercabsByRegion", {})
    ]);

    var fleet = results[0].value || results[0];
    var cybercabData = results[1].value || results[1];

    var testRegionCount = 0;
    if (cybercabData && cybercabData.regions) {
      cybercabData.regions.forEach(function (region) {
        if (region.isTestRegion && region.cybercabs) {
          testRegionCount += region.cybercabs.length;
        }
      });
    }

    var ts = fleet.tripStats || {};

    // ── Per-city breakdown (new) ──
    // Try multiple Convex query patterns to get Austin vs Bay Area counts.
    // The tracker's frontend filters by area — we try the most likely
    // query shapes and fall back gracefully if none work.
    var areas = { austin: null, bayArea: null };
    var areaDebug = [];

    // Approach 1: getHomepageData with area filter
    try {
      var areaResults = await Promise.all([
        convexQuery("queries/fleet:getHomepageData", {
          provider: "tesla",
          sortBy: "recently_discovered",
          tripLimit: 1,
          vehicleLimit: 1,
          area: "austin"
        }),
        convexQuery("queries/fleet:getHomepageData", {
          provider: "tesla",
          sortBy: "recently_discovered",
          tripLimit: 1,
          vehicleLimit: 1,
          area: "bay_area"
        })
      ]);

      var austinData = areaResults[0].value || areaResults[0];
      var bayData = areaResults[1].value || areaResults[1];

      if (
        austinData && typeof austinData.totalFleetCount === "number" &&
        bayData && typeof bayData.totalFleetCount === "number" &&
        austinData.totalFleetCount !== fleet.totalFleetCount
      ) {
        areas.austin = austinData.totalFleetCount;
        areas.bayArea = bayData.totalFleetCount;
        areaDebug.push("approach1_homepage_area");
      } else {
        areaDebug.push("approach1_same_total_or_missing");
      }
    } catch (e) {
      areaDebug.push("approach1_error:" + e.message);
    }

    // Approach 2: getVehicles with area filter
    if (areas.austin === null) {
      try {
        var vResults = await Promise.all([
          convexQuery("queries/vehicles:getVehicles", {
            provider: "tesla",
            area: "austin"
          }),
          convexQuery("queries/vehicles:getVehicles", {
            provider: "tesla",
            area: "bay_area"
          })
        ]);

        var aV = vResults[0].value || vResults[0];
        var bV = vResults[1].value || vResults[1];

        function extractCount(data) {
          if (Array.isArray(data)) return data.length;
          if (data && typeof data.totalCount === "number") return data.totalCount;
          if (data && Array.isArray(data.vehicles)) return data.vehicles.length;
          if (data && typeof data.count === "number") return data.count;
          return null;
        }

        var ac = extractCount(aV);
        var bc = extractCount(bV);

        if (ac !== null && bc !== null) {
          areas.austin = ac;
          areas.bayArea = bc;
          areaDebug.push("approach2_getVehicles");
        } else {
          areaDebug.push("approach2_no_count");
        }
      } catch (e) {
        areaDebug.push("approach2_error:" + e.message);
      }
    }

    // Approach 3: getFleetRegistry with area filter
    if (areas.austin === null) {
      try {
        var rResults = await Promise.all([
          convexQuery("queries/vehicles:getFleetRegistry", {
            provider: "tesla",
            area: "austin"
          }),
          convexQuery("queries/vehicles:getFleetRegistry", {
            provider: "tesla",
            area: "bay_area"
          })
        ]);

        var aR = rResults[0].value || rResults[0];
        var bR = rResults[1].value || rResults[1];

        function extractCount2(data) {
          if (Array.isArray(data)) return data.length;
          if (data && typeof data.totalCount === "number") return data.totalCount;
          if (data && Array.isArray(data.vehicles)) return data.vehicles.length;
          if (data && typeof data.count === "number") return data.count;
          return null;
        }

        var ac2 = extractCount2(aR);
        var bc2 = extractCount2(bR);

        if (ac2 !== null && bc2 !== null) {
          areas.austin = ac2;
          areas.bayArea = bc2;
          areaDebug.push("approach3_fleetRegistry");
        } else {
          areaDebug.push("approach3_no_count");
        }
      } catch (e) {
        areaDebug.push("approach3_error:" + e.message);
      }
    }

    // Approach 4: getVehiclesByServiceArea
    if (areas.austin === null) {
      try {
        var sResults = await Promise.all([
          convexQuery("queries/vehicles:getVehiclesByServiceArea", {
            serviceArea: "austin"
          }),
          convexQuery("queries/vehicles:getVehiclesByServiceArea", {
            serviceArea: "bay_area"
          })
        ]);

        var aS = sResults[0].value || sResults[0];
        var bS = sResults[1].value || sResults[1];

        function extractCount3(data) {
          if (Array.isArray(data)) return data.length;
          if (data && typeof data.totalCount === "number") return data.totalCount;
          if (data && Array.isArray(data.vehicles)) return data.vehicles.length;
          if (data && typeof data.count === "number") return data.count;
          return null;
        }

        var ac3 = extractCount3(aS);
        var bc3 = extractCount3(bS);

        if (ac3 !== null && bc3 !== null) {
          areas.austin = ac3;
          areas.bayArea = bc3;
          areaDebug.push("approach4_byServiceArea");
        } else {
          areaDebug.push("approach4_no_count");
        }
      } catch (e) {
        areaDebug.push("approach4_error:" + e.message);
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
        austinCount: areas.austin,
        bayAreaCount: areas.bayArea,
        totalTrips: ts.totalTrips,
        totalMiles: ts.totalMiles,
        avgFare: ts.avgPrice,
        avgTripMiles: ts.avgMiles,
        totalContributors: ts.totalContributors
      },
      _areaDebug: areaDebug
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
