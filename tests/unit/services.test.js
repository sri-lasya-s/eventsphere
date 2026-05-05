// tests/unit/weather.test.js
const axios = require("axios");
jest.mock("axios");

// Must set env before requiring the module
process.env.OPENWEATHER_API_KEY = "test-key";

const weatherService = require("../../src/services/weather.service");

const mockWeatherResponse = {
  main: { temp: 22, feels_like: 20, humidity: 65 },
  weather: [{ description: "partly cloudy", icon: "02d" }],
  wind: { speed: 5.2 },
  name: "Chicago",
  sys: { country: "US", sunrise: 1700000000, sunset: 1700040000 },
};

const mockGeoResponse = [{ lat: 41.8781, lon: -87.6298 }];

describe("Weather Service", () => {
  beforeEach(() => jest.clearAllMocks());

  test("getCurrentWeather returns formatted data for city name", async () => {
    axios.get
      .mockResolvedValueOnce({ data: mockGeoResponse })   // geocode
      .mockResolvedValueOnce({ data: mockWeatherResponse }); // weather

    const result = await weatherService.getCurrentWeather({ location: "Chicago, IL" });

    expect(result).toMatchObject({
      temperature: 22,
      feelsLike: 20,
      humidity: 65,
      cityName: "Chicago",
      country: "US",
    });
    expect(result.icon).toContain("openweathermap.org");
  });

  test("getCurrentWeather uses lat/lon directly (skips geocode)", async () => {
    axios.get.mockResolvedValueOnce({ data: mockWeatherResponse });

    // Use different coords than the previous test to avoid cache hit
    const result = await weatherService.getCurrentWeather({ lat: 34.05, lon: -118.25 });

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(result.temperature).toBe(22);
  });

  test("getCurrentWeather throws when location not found", async () => {
    axios.get.mockResolvedValueOnce({ data: [] }); // empty geocode
    await expect(
      weatherService.getCurrentWeather({ location: "Nonexistentplace123" })
    ).rejects.toThrow("Location not found");
  });
});

// tests/unit/auth.test.js
describe("Auth Utils", () => {
  const { hashPassword, comparePassword, signToken, verifyToken } = require("../../src/utils/auth");

  test("hashPassword produces a bcrypt hash", async () => {
    const hash = await hashPassword("testpass123");
    expect(hash).not.toBe("testpass123");
    expect(hash.startsWith("$2")).toBe(true);
  });

  test("comparePassword returns true for correct password", async () => {
    const hash = await hashPassword("mypassword");
    const match = await comparePassword("mypassword", hash);
    expect(match).toBe(true);
  });

  test("comparePassword returns false for wrong password", async () => {
    const hash = await hashPassword("mypassword");
    const match = await comparePassword("wrongpassword", hash);
    expect(match).toBe(false);
  });

  test("signToken + verifyToken round-trip", () => {
    const payload = { userId: "abc-123", role: "ATTENDEE" };
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe("abc-123");
    expect(decoded.role).toBe("ATTENDEE");
  });

  test("verifyToken returns null for invalid token", () => {
    const result = verifyToken("not.a.valid.token");
    expect(result).toBeNull();
  });
});
