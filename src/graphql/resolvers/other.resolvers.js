// src/graphql/resolvers/other.resolvers.js
const { AuthenticationError, ForbiddenError, UserInputError, ConflictError, NotFoundError } = require("../../utils/errors");

const userResolvers = {
  Query: {
    me: (_p, _a, { prisma, user }) => {
      if (!user) throw AuthenticationError();
      return prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    },
    users: (_p, _a, { prisma, user }) => {
      if (!user || user.role !== "ORGANIZER") throw ForbiddenError("Organizer only");
      return prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    },
    user: async (_p, { id }, { prisma }) => {
      const u = await prisma.user.findUnique({ where: { id } });
      if (!u) throw NotFoundError("User not found");
      return u;
    },
  },
  User: {
    events: (u, _a, { prisma }) => prisma.event.findMany({ where: { organizerId: u.id } }),
    rsvps: (u, _a, { prisma }) => prisma.rSVP.findMany({ where: { userId: u.id }, include: { event: true } }),
    rsvpCount: (u, _a, { prisma }) => prisma.rSVP.count({ where: { userId: u.id } }),
  },
};

const rsvpResolvers = {
  Query: {
    myRsvps: (_p, _a, { prisma, user }) => {
      if (!user) throw AuthenticationError();
      return prisma.rSVP.findMany({ where: { userId: user.userId }, include: { event: true }, orderBy: { createdAt: "desc" } });
    },
  },
  Mutation: {
    createRsvp: async (_p, { eventId, status, note }, { prisma, user }) => {
      if (!user) throw AuthenticationError();
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) throw NotFoundError("Event not found");
      if (event.status === "CANCELLED") throw UserInputError("Cannot RSVP to a cancelled event", "eventId");
      const existing = await prisma.rSVP.findUnique({ where: { userId_eventId: { userId: user.userId, eventId } } });
      if (existing) throw ConflictError("You have already RSVP'd to this event");
      if (status === "GOING") {
        const going = await prisma.rSVP.count({ where: { eventId, status: "GOING" } });
        if (going >= event.capacity) throw UserInputError("Event is at full capacity", "eventId");
      }
      return prisma.rSVP.create({ data: { userId: user.userId, eventId, status, note }, include: { user: true, event: true } });
    },
    updateRsvp: async (_p, { eventId, status, note }, { prisma, user }) => {
      if (!user) throw AuthenticationError();
      const existing = await prisma.rSVP.findUnique({ where: { userId_eventId: { userId: user.userId, eventId } } });
      if (!existing) throw NotFoundError("RSVP not found");
      return prisma.rSVP.update({ where: { userId_eventId: { userId: user.userId, eventId } }, data: { status, note }, include: { user: true, event: true } });
    },
    deleteRsvp: async (_p, { eventId }, { prisma, user }) => {
      if (!user) throw AuthenticationError();
      const existing = await prisma.rSVP.findUnique({ where: { userId_eventId: { userId: user.userId, eventId } } });
      if (!existing) throw NotFoundError("RSVP not found");
      await prisma.rSVP.delete({ where: { userId_eventId: { userId: user.userId, eventId } } });
      return true;
    },
  },
  RSVP: {
    user: (r, _a, { prisma }) => prisma.user.findUniqueOrThrow({ where: { id: r.userId } }),
    event: (r, _a, { prisma }) => prisma.event.findUniqueOrThrow({ where: { id: r.eventId } }),
  },
};

const categoryResolvers = {
  Query: {
    categories: (_p, _a, { prisma }) => prisma.category.findMany({ orderBy: { name: "asc" } }),
    category: async (_p, { id }, { prisma }) => {
      const cat = await prisma.category.findUnique({ where: { id } });
      if (!cat) throw NotFoundError("Category not found");
      return cat;
    },
  },
  Mutation: {
    createCategory: async (_p, args, { prisma, user }) => {
      if (!user || user.role !== "ORGANIZER") throw ForbiddenError("Organizer only");
      const exists = await prisma.category.findUnique({ where: { name: args.name } });
      if (exists) throw ConflictError("Category already exists");
      return prisma.category.create({ data: args });
    },
  },
  Category: {
    eventCount: (c, _a, { prisma }) => prisma.event.count({ where: { categoryId: c.id } }),
  },
};

const { GraphQLScalarType, Kind } = require("graphql");
const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  serialize: (v) => (v instanceof Date ? v.toISOString() : v),
  parseValue: (v) => new Date(v),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? new Date(ast.value) : null),
});

module.exports = {
  DateTime: DateTimeScalar,
  Query: { ...userResolvers.Query, ...rsvpResolvers.Query, ...categoryResolvers.Query },
  Mutation: { ...rsvpResolvers.Mutation, ...categoryResolvers.Mutation },
  User: userResolvers.User,
  RSVP: rsvpResolvers.RSVP,
  Category: categoryResolvers.Category,
};