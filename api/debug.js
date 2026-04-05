// ─────────────────────────────────────────────────────────
// FILE: api/debug.js
// Temporary diagnostic — dumps raw Convex responses
// Hit: robotaxi-proxy.vercel.app/api/debug
// DELETE THIS FILE after finding the right query shape
// ─────────────────────────────────────────────────────────

const CONVEX_URL = "https://graceful-eel-151.convex.cloud/api/query";

function q(path, args) {
  return fetch(CONVEX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: path, args: args || {} })
  })
    .then(function (r) { return r.json(); })
    .then(function (j) { return { ok: true, data: j }; })
    .catch(function (e) { return { ok: false, error: e.message }; });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache");

  var results = {};

  // 1. What does getHomepageData return with area:"austin"?
  results["homepage_austin"] = await q("queries/fleet:getHomepageData", {
    provider: "tesla", sortBy: "recently_discovered",
    tripLimit: 1, vehicleLimit: 1, area: "austin"
  });

  // 2. What does getHomepageData return with serviceArea:"austin"?
  results["homepage_serviceArea_austin"] = await q("queries/fleet:getHomepageData", {
    provider: "tesla", sortBy: "recently_discovered",
    tripLimit: 1, vehicleLimit: 1, serviceArea: "austin"
  });

  // 3. What does getVehicles return?
  results["getVehicles_austin"] = await q("queries/vehicles:getVehicles", {
    provider: "tesla", area: "austin"
  });

  // 4. What does getVehicles return with no area filter?
  results["getVehicles_nofilter"] = await q("queries/vehicles:getVehicles", {
    provider: "tesla"
  });

  // 5. Try listing query functions on vehicles module
  results["listVehicles"] = await q("queries/vehicles:list", {
    provider: "tesla", area: "austin"
  });

  // 6. Try getFleetRegistry
  results["fleetRegistry_austin"] = await q("queries/vehicles:getFleetRegistry", {
    provider: "tesla", area: "austin"
  });

  // 7. Try getFleetRegistry with no args
  results["fleetRegistry_noargs"] = await q("queries/vehicles:getFleetRegistry", {});

  // 8. Try getVehicleCount
  results["vehicleCount_austin"] = await q("queries/vehicles:getVehicleCount", {
    provider: "tesla", area: "austin"
  });

  // 9. Try fleet:getFleetStats
  results["fleetStats"] = await q("queries/fleet:getFleetStats", {
    provider: "tesla"
  });

  // 10. Try fleet:getAreaBreakdown
  results["areaBreakdown"] = await q("queries/fleet:getAreaBreakdown", {
    provider: "tesla"
  });

  // 11. Try vehicles:getVehiclesByServiceArea
  results["byServiceArea"] = await q("queries/vehicles:getVehiclesByServiceArea", {
    serviceArea: "austin"
  });

  // 12. Try the cybercab query we know works — inspect its region structure
  results["cybercabRegions"] = await q("queries/vehicles:getCybercabsByRegion", {});

  // 13. Try fleet:getFleetGrowth (might have per-area data)
  results["fleetGrowth"] = await q("queries/fleet:getFleetGrowth", {
    provider: "tesla"
  });

  // 14. Try fleet:getServiceAreas
  results["serviceAreas"] = await q("queries/fleet:getServiceAreas", {
    provider: "tesla"
  });

  // 15. Try vehicles:getAll with area
  results["getAll_austin"] = await q("queries/vehicles:getAll", {
    provider: "tesla", area: "austin"
  });

  return res.status(200).json(results);
};
