// src/graphql/resolvers/auth.resolvers.js
const { hashPassword, comparePassword, signToken } = require("../../utils/auth");
const { UserInputError, ConflictError, AuthenticationError } = require("../../utils/errors");
const logger = require("../../utils/logger");

const authResolvers = {
  Mutation: {
    register: async (_parent, { input }, { prisma }) => {
      const { email, name, password } = input;
      if (password.length < 8) throw UserInputError("Password must be at least 8 characters", "password");
      if (!/\S+@\S+\.\S+/.test(email)) throw UserInputError("Invalid email format", "email");
      if (name.trim().length < 2) throw UserInputError("Name must be at least 2 characters", "name");
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) throw ConflictError("Email already registered");
      const user = await prisma.user.create({
        data: { email, name: name.trim(), password: await hashPassword(password) },
      });
      logger.info(`New user registered: ${email}`);
      return { token: signToken({ userId: user.id, role: user.role }), user };
    },

    login: async (_parent, { email, password }, { prisma }) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw AuthenticationError("Invalid credentials");
      const valid = await comparePassword(password, user.password);
      if (!valid) throw AuthenticationError("Invalid credentials");
      logger.info(`User logged in: ${email}`);
      return { token: signToken({ userId: user.id, role: user.role }), user };
    },
  },
};

module.exports = authResolvers;