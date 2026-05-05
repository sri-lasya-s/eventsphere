// src/graphql/typeDefs/index.js
const { gql } = require("graphql-tag");

module.exports = gql`
  scalar DateTime

  # ─── Enums ────────────────────────────────────────────────────────
  enum Role { ORGANIZER ATTENDEE }
  enum EventStatus { UPCOMING ONGOING COMPLETED CANCELLED }
  enum RSVPStatus { GOING MAYBE NOT_GOING }

  # ─── Auth ─────────────────────────────────────────────────────────
  type AuthPayload {
    token: String!
    user: User!
  }

  # ─── User ─────────────────────────────────────────────────────────
  type User {
    id: ID!
    email: String!
    name: String!
    avatar: String
    role: Role!
    createdAt: DateTime!
    events: [Event!]!
    rsvps: [RSVP!]!
    rsvpCount: Int!
  }

  # ─── Category ─────────────────────────────────────────────────────
  type Category {
    id: ID!
    name: String!
    description: String
    color: String!
    icon: String!
    eventCount: Int!
  }

  # ─── Event ────────────────────────────────────────────────────────
  type Event {
    id: ID!
    title: String!
    description: String!
    location: String!
    latitude: Float
    longitude: Float
    startDate: DateTime!
    endDate: DateTime!
    capacity: Int!
    status: EventStatus!
    imageUrl: String
    createdAt: DateTime!
    organizer: User!
    category: Category!
    rsvps: [RSVP!]!
    attendeeCount: Int!
    spotsLeft: Int!
    weather: WeatherData
    forecast: ForecastData
    isUserRsvped: Boolean!
  }

  # ─── RSVP ─────────────────────────────────────────────────────────
  type RSVP {
    id: ID!
    status: RSVPStatus!
    note: String
    createdAt: DateTime!
    user: User!
    event: Event!
  }

  # ─── Weather ──────────────────────────────────────────────────────
  type WeatherData {
    temperature: Int!
    feelsLike: Int!
    humidity: Int!
    description: String!
    icon: String!
    windSpeed: Float!
    cityName: String!
    country: String!
    sunrise: String!
    sunset: String!
  }

  type ForecastDay {
    date: String!
    tempMin: Int!
    tempMax: Int!
    description: String!
    icon: String!
    humidity: Int!
    windSpeed: Float!
    precipitation: Int!
  }

  type ForecastData {
    cityName: String!
    country: String!
    days: [ForecastDay!]!
  }

  # ─── Pagination ───────────────────────────────────────────────────
  type EventConnection {
    edges: [Event!]!
    totalCount: Int!
    hasNextPage: Boolean!
  }

  # ─── Inputs ───────────────────────────────────────────────────────
  input RegisterInput {
    email: String!
    name: String!
    password: String!
  }

  input CreateEventInput {
    title: String!
    description: String!
    location: String!
    latitude: Float
    longitude: Float
    startDate: DateTime!
    endDate: DateTime!
    capacity: Int!
    categoryId: ID!
    imageUrl: String
  }

  input UpdateEventInput {
    title: String
    description: String
    location: String
    startDate: DateTime
    endDate: DateTime
    capacity: Int
    status: EventStatus
    categoryId: ID
    imageUrl: String
  }

  input EventFilters {
    status: EventStatus
    categoryId: ID
    search: String
    upcoming: Boolean
  }

  # ─── Query ────────────────────────────────────────────────────────
  type Query {
    # Auth
    me: User

    # Users
    users: [User!]!
    user(id: ID!): User

    # Events
    events(filters: EventFilters, limit: Int, offset: Int): EventConnection!
    event(id: ID!): Event

    # Categories
    categories: [Category!]!
    category(id: ID!): Category

    # RSVPs
    myRsvps: [RSVP!]!

    # Weather (standalone)
    weatherForLocation(location: String!): WeatherData
    forecastForLocation(location: String!): ForecastData
  }

  # ─── Mutation ─────────────────────────────────────────────────────
  type Mutation {
    # Auth
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!

    # Events
    createEvent(input: CreateEventInput!): Event!
    updateEvent(id: ID!, input: UpdateEventInput!): Event!
    deleteEvent(id: ID!): Boolean!
    cancelEvent(id: ID!): Event!

    # RSVPs
    createRsvp(eventId: ID!, status: RSVPStatus!, note: String): RSVP!
    updateRsvp(eventId: ID!, status: RSVPStatus!, note: String): RSVP!
    deleteRsvp(eventId: ID!): Boolean!

    # Admin
    createCategory(name: String!, description: String, color: String, icon: String): Category!
  }
`;
