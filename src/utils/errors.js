// src/utils/errors.js
const { GraphQLError } = require("graphql");

const AuthenticationError = (message = "Authentication required") =>
  new GraphQLError(message, { extensions: { code: "UNAUTHENTICATED" } });

const ForbiddenError = (message = "Insufficient permissions") =>
  new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });

const UserInputError = (message, field) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT", field } });

const NotFoundError = (message = "Resource not found") =>
  new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });

const ConflictError = (message = "Resource already exists") =>
  new GraphQLError(message, { extensions: { code: "CONFLICT" } });

module.exports = { AuthenticationError, ForbiddenError, UserInputError, NotFoundError, ConflictError };