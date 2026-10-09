const { isPublicListing } = require("./listingHonesty");
const core = require("@lodgist/spatial-core");

core.configureSpatialCore({ isPublicListing });

module.exports = core;
