// src/graphql/resolvers/event.resolvers.js
const { getCurrentWeather, getForecast } = require("../../services/weather.service");
const { AuthenticationError, ForbiddenError, UserInputError, NotFoundError } = require("../../utils/errors");
const logger = require("../../utils/logger");

const requireAuth = (user) => { if (!user) throw AuthenticationError(); };
const requireRole = (user, ...roles) => { requireAuth(user); if (!roles.includes(user.role)) throw ForbiddenError(); };

const validateEventInput = (input) => {
  if (input.title !== undefined && input.title.trim().length < 3)
    throw UserInputError("Title must be at least 3 characters", "title");
  if (input.capacity !== undefined && input.capacity < 1)
    throw UserInputError("Capacity must be at least 1", "capacity");
  if (input.startDate && input.endDate && new Date(input.endDate) <= new Date(input.startDate))
    throw UserInputError("End date must be after start date", "endDate");
};

const eventResolvers = {
  Query: {
    events: async (_p, { filters = {}, limit = 20, offset = 0 }, { prisma }) => {
      const where = {};
      if (filters.status) where.status = filters.status;
      if (filters.categoryId) where.categoryId = filters.categoryId;
      if (filters.upcoming) where.startDate = { gte: new Date() };
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
          { location: { contains: filters.search, mode: "insensitive" } },
        ];
      }
      const [edges, totalCount] = await prisma.$transaction([
        prisma.event.findMany({ where, skip: offset, take: limit, orderBy: { startDate: "asc" } }),
        prisma.event.count({ where }),
      ]);
      return { edges, totalCount, hasNextPage: offset + limit < totalCount };
    },

    event: async (_p, { id }, { prisma }) => {
      const event = await prisma.event.findUnique({ where: { id } });
      if (!event) throw NotFoundError("Event not found");
      return event;
    },

    weatherForLocation: async (_p, { location }) => {
      try { return await getCurrentWeather({ location }); }
      catch (err) { logger.error(`Weather fetch failed: ${err.message}`); throw UserInputError("Could not fetch weather for this location", "location"); }
    },

    forecastForLocation: async (_p, { location }) => {
      try { return await getForecast({ location }); }
      catch (err) { logger.error(`Forecast fetch failed: ${err.message}`); throw UserInputError("Could not fetch forecast for this location", "location"); }
    },
  },

  Mutation: {
    createEvent: async (_p, { input }, { prisma, user }) => {
      requireRole(user, "ORGANIZER");
      validateEventInput(input);
      const event = await prisma.event.create({ data: { ...input, organizerId: user.userId } });
      logger.info(`Event created: ${event.title} by ${user.userId}`);
      return event;
    },

    updateEvent: async (_p, { id, input }, { prisma, user }) => {
      requireAuth(user);
      validateEventInput(input);
      const event = await prisma.event.findUnique({ where: { id } });
      if (!event) throw NotFoundError("Event not found");
      if (event.organizerId !== user.userId && user.role !== "ORGANIZER") throw ForbiddenError("Not authorized to update this event");
      return prisma.event.update({ where: { id }, data: input });
    },

    deleteEvent: async (_p, { id }, { prisma, user }) => {
      requireAuth(user);
      const event = await prisma.event.findUnique({ where: { id } });
      if (!event) throw NotFoundError("Event not found");
      if (event.organizerId !== user.userId && user.role !== "ORGANIZER") throw ForbiddenError("Not authorized to delete this event");
      await prisma.event.delete({ where: { id } });
      logger.info(`Event deleted: ${id}`);
      return true;
    },

    cancelEvent: async (_p, { id }, { prisma, user }) => {
      requireAuth(user);
      const event = await prisma.event.findUnique({ where: { id } });
      if (!event) throw NotFoundError("Event not found");
      if (event.organizerId !== user.userId && user.role !== "ORGANIZER") throw ForbiddenError("Not authorized");
      return prisma.event.update({ where: { id }, data: { status: "CANCELLED" } });
    },
  },

  Event: {
    organizer: (e, _a, { prisma }) => prisma.user.findUniqueOrThrow({ where: { id: e.organizerId } }),
    category: (e, _a, { prisma }) => prisma.category.findUniqueOrThrow({ where: { id: e.categoryId } }),
    rsvps: (e, _a, { prisma }) => prisma.rSVP.findMany({ where: { eventId: e.id }, include: { user: true } }),
    attendeeCount: async (e, _a, { prisma }) => prisma.rSVP.count({ where: { eventId: e.id, status: { in: ["GOING", "MAYBE"] } } }),
    spotsLeft: async (e, _a, { prisma }) => {
      const going = await prisma.rSVP.count({ where: { eventId: e.id, status: "GOING" } });
      return Math.max(0, e.capacity - going);
    },
    isUserRsvped: async (e, _a, { prisma, user }) => {
      if (!user) return false;
      const rsvp = await prisma.rSVP.findUnique({ where: { userId_eventId: { userId: user.userId, eventId: e.id } } });
      return !!rsvp;
    },
    weather: async (e) => {
      try { return await getCurrentWeather(e.latitude && e.longitude ? { lat: e.latitude, lon: e.longitude } : { location: e.location }); }
      catch { return null; }
    },
    forecast: async (e) => {
      try { return await getForecast(e.latitude && e.longitude ? { lat: e.latitude, lon: e.longitude } : { location: e.location }); }
      catch { return null; }
    },
  },
};

module.exports = eventResolvers;