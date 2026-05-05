// src/graphql/resolvers/index.js
const authResolvers = require("./auth.resolvers");
const eventResolvers = require("./event.resolvers");
const otherResolvers = require("./other.resolvers");

// Deep merge resolver maps
const merge = (...resolvers) => {
  const result = {};
  for (const r of resolvers) {
    for (const [key, val] of Object.entries(r)) {
      if (typeof val === "object" && !Array.isArray(val) && result[key]) {
        result[key] = { ...result[key], ...val };
      } else {
        result[key] = val;
      }
    }
  }
  return result;
};

module.exports = merge(authResolvers, eventResolvers, otherResolvers);
