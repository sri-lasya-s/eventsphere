// src/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { PrismaClient } = require("@prisma/client");

const typeDefs = require("./graphql/typeDefs");
const resolvers = require("./graphql/resolvers");
const { extractUser } = require("./utils/auth");
const logger = require("./utils/logger");

const prisma = new PrismaClient();

const createApp = async () => {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  app.use(express.json());

  // Serve frontend SPA
  app.use(express.static(path.join(__dirname, "../frontend")));

  // Health check
  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date() }));

  // Apollo Server
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const server = new ApolloServer({
    schema,
    introspection: true,                     // enables GraphQL Playground
    formatError: (formattedError, error) => {
      logger.error(`GraphQL Error: ${formattedError.message}`, { error });
      // Don't expose internal errors in production
      if (process.env.NODE_ENV === "production" && !formattedError.extensions?.code) {
        return { message: "Internal server error", extensions: formattedError.extensions };
      }
      return formattedError;
    },
  });

  await server.start();

  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => ({
        prisma,
        user: extractUser(req),
        req,
      }),
    })
  );

  // Catch-all → SPA
  app.get("*", (_req, res) =>
    res.sendFile(path.join(__dirname, "../frontend/index.html"))
  );

  return { app, server, prisma };
};

// Start server (only when not imported by tests)
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  createApp()
    .then(({ app }) => {
      app.listen(PORT, () => {
        logger.info(`🚀 Server running on http://localhost:${PORT}`);
        logger.info(`📊 GraphQL Playground: http://localhost:${PORT}/graphql`);
      });
    })
    .catch((err) => {
      logger.error("Failed to start server", err);
      process.exit(1);
    });
}

module.exports = { createApp, prisma };
