const CONVEX_URL = "https://graceful-eel-151.convex.cloud/api/query";
function q(path, args) {
  return fetch(CONVEX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: path, args: args || {} })
  }).then(r => r.json()).catch(e => ({ error: e.message }));
}
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache");

  // Dump the FULL getHomepageData response — look for area counts
  var homepage = await q("queries/fleet:getHomepageData", {
    provider: "tesla", sortBy: "recently_discovered", tripLimit: 1, vehicleLimit: 1
  });

  // Try getFleetGrowthData or similar
  var growth = await q("queries/fleet:getFleetGrowthData", { provider: "tesla" });
  var counts = await q("queries/fleet:getFleetCounts", { provider: "tesla" });
  var areas = await q("queries/fleet:getServiceAreaCounts", { provider: "tesla" });
  var areaStats = await q("queries/fleet:getAreaStats", { provider: "tesla" });
  var dashboard = await q("queries/fleet:getDashboardData", { provider: "tesla" });
  var trendsData = await q("queries/fleet:getTrendsData", { provider: "tesla" });
  var fleetByArea = await q("queries/fleet:getFleetCountsByArea", { provider: "tesla" });
  var vehicleCounts = await q("queries/vehicles:getVehicleCounts", { provider: "tesla" });
  var areaVehicles = await q("queries/vehicles:getAreaVehicleCounts", { provider: "tesla" });
  var regionStats = await q("queries/vehicles:getRegionStats", { provider: "tesla" });

  return res.status(200).json({
    homepage_FULL: homepage,
    growth, counts, areas, areaStats, dashboard,
    trendsData, fleetByArea, vehicleCounts, areaVehicles, regionStats
  });
};
