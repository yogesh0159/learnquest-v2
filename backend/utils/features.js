function enabled(value) { return String(value || "").toLowerCase() === "true"; }
function schoolFeatureEnabled(env = process.env) { return enabled(env.SCHOOL_FEATURE_ENABLED); }
module.exports = { enabled, schoolFeatureEnabled };
