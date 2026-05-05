// tests/integration/graphql.test.js
/**
 * Integration tests use a real Apollo Server + mocked Prisma.
 * This avoids needing a live DB while still testing the full resolver chain.
 */
const { ApolloServer } = require("@apollo/server");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const typeDefs = require("../../src/graphql/typeDefs");
const resolvers = require("../../src/graphql/resolvers");

// ─── Mock Prisma ────────────────────────────────────────────────────────────
const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  password: "$2b$10$hashedpassword",
  role: "ORGANIZER",
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCategory = {
  id: "cat-1",
  name: "Technology",
  description: "Tech events",
  color: "#6366f1",
  icon: "💻",
};

const mockEvent = {
  id: "event-1",
  title: "Test Conference",
  description: "A test event",
  location: "Chicago, IL",
  latitude: 41.8781,
  longitude: -87.6298,
  startDate: new Date(Date.now() + 86400000),
  endDate: new Date(Date.now() + 172800000),
  capacity: 100,
  status: "UPCOMING",
  imageUrl: null,
  organizerId: "user-1",
  categoryId: "cat-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const prisma = {
  user: {
    findUnique: jest.fn().mockResolvedValue(mockUser),
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockUser),
    findMany: jest.fn().mockResolvedValue([mockUser]),
    create: jest.fn().mockResolvedValue(mockUser),
  },
  event: {
    findMany: jest.fn().mockResolvedValue([mockEvent]),
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockEvent),
    count: jest.fn().mockResolvedValue(1),
    create: jest.fn().mockResolvedValue(mockEvent),
    update: jest.fn().mockResolvedValue({ ...mockEvent, status: "CANCELLED" }),
    delete: jest.fn().mockResolvedValue(mockEvent),
  },
  category: {
    findMany: jest.fn().mockResolvedValue([mockCategory]),
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockCategory),
    create: jest.fn().mockResolvedValue(mockCategory),
  },
  rSVP: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(5),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(([a, b]) => Promise.all([a, b])),
};

// ─── Test Server ────────────────────────────────────────────────────────────
let server;

const executeOperation = (query, variables = {}, userCtx = null) =>
  server.executeOperation(
    { query, variables },
    { contextValue: { prisma, user: userCtx } }
  );

beforeAll(async () => {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  server = new ApolloServer({ schema });
  await server.start();
});

afterAll(() => server.stop());
afterEach(() => jest.clearAllMocks());

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Query: events", () => {
  test("returns paginated event list", async () => {
    const { body } = await executeOperation(`
      query {
        events {
          totalCount
          hasNextPage
          edges { id title location status }
        }
      }
    `);
    const data = body.singleResult?.data;
    expect(data.events.edges).toHaveLength(1);
    expect(data.events.edges[0].title).toBe("Test Conference");
    expect(data.events.totalCount).toBe(1);
  });

  test("accepts status filter", async () => {
    await executeOperation(`
      query { events(filters: { status: UPCOMING }) { edges { id } } }
    `);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "UPCOMING" }) })
    );
  });
});

describe("Query: categories", () => {
  test("returns all categories", async () => {
    const { body } = await executeOperation(`
      query { categories { id name icon color } }
    `);
    expect(body.singleResult?.data.categories[0].name).toBe("Technology");
  });
});

describe("Query: me", () => {
  test("returns current user when authenticated", async () => {
    const { body } = await executeOperation(
      `query { me { id email name role } }`,
      {},
      { userId: "user-1", role: "ORGANIZER" }
    );
    expect(body.singleResult?.data.me.email).toBe("test@example.com");
  });

  test("throws error when unauthenticated", async () => {
    const { body } = await executeOperation(`query { me { id } }`);
    expect(body.singleResult?.errors[0].message).toBeTruthy();
  });
});

describe("Mutation: register", () => {
  test("throws if email already exists", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(mockUser); // email taken
    const { body } = await executeOperation(`
      mutation {
        register(input: { email: "test@example.com", name: "Dup", password: "Password1!" }) {
          token
        }
      }
    `);
    expect(body.singleResult?.errors[0].message).toBeTruthy();
  });

  test("throws if password too short", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const { body } = await executeOperation(`
      mutation {
        register(input: { email: "new@example.com", name: "New", password: "short" }) {
          token
        }
      }
    `);
expect(body.singleResult?.errors[0].message).toBeTruthy();  });
});

describe("Mutation: createEvent", () => {
  const input = {
    title: "New Event",
    description: "Desc",
    location: "NY",
    startDate: new Date(Date.now() + 86400000).toISOString(),
    endDate: new Date(Date.now() + 172800000).toISOString(),
    capacity: 50,
    categoryId: "cat-1",
  };

  test("organizer can create event", async () => {
    const { body } = await executeOperation(
      `mutation CreateEvent($input: CreateEventInput!) { createEvent(input: $input) { id title } }`,
      { input },
      { userId: "user-1", role: "ORGANIZER" }
    );
    expect(body.singleResult?.errors).toBeUndefined();
    expect(body.singleResult?.data.createEvent.title).toBe("Test Conference");
  });

  test("attendee cannot create event", async () => {
    const { body } = await executeOperation(
      `mutation CreateEvent($input: CreateEventInput!) { createEvent(input: $input) { id } }`,
      { input },
      { userId: "user-1", role: "ATTENDEE" }
    );
    expect(body.singleResult?.errors[0].message).toBeTruthy();
  });

  test("unauthenticated user cannot create event", async () => {
    const { body } = await executeOperation(
      `mutation CreateEvent($input: CreateEventInput!) { createEvent(input: $input) { id } }`,
      { input }
    );
    expect(body.singleResult?.errors[0].message).toBeTruthy();
  });
});
