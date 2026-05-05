// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: "Technology" },
      update: {},
      create: { name: "Technology", description: "Tech conferences & hackathons", color: "#6366f1", icon: "💻" },
    }),
    prisma.category.upsert({
      where: { name: "Music" },
      update: {},
      create: { name: "Music", description: "Concerts & live performances", color: "#ec4899", icon: "🎵" },
    }),
    prisma.category.upsert({
      where: { name: "Sports" },
      update: {},
      create: { name: "Sports", description: "Sports events & tournaments", color: "#22c55e", icon: "⚽" },
    }),
    prisma.category.upsert({
      where: { name: "Food & Drink" },
      update: {},
      create: { name: "Food & Drink", description: "Food festivals & tastings", color: "#f59e0b", icon: "🍕" },
    }),
  ]);

  // Users
  const hashedPassword = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@eventsphere.com" },
    update: {},
    create: { email: "admin@eventsphere.com", name: "Admin User", password: hashedPassword, role: "ORGANIZER" },
  });

  const organizer = await prisma.user.upsert({
    where: { email: "organizer@eventsphere.com" },
    update: {},
    create: { email: "organizer@eventsphere.com", name: "Jane Smith", password: hashedPassword, role: "ORGANIZER" },
  });

  const attendee = await prisma.user.upsert({
    where: { email: "user@eventsphere.com" },
    update: {},
    create: { email: "user@eventsphere.com", name: "John Doe", password: hashedPassword, role: "ATTENDEE" },
  });

  // Events
  const now = new Date();
  const event1 = await prisma.event.create({
    data: {
      title: "Chicago Tech Summit 2025",
      description: "The premier technology conference in the Midwest. Join 500+ developers, designers, and entrepreneurs.",
      location: "Chicago, IL",
      latitude: 41.8781,
      longitude: -87.6298,
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
      capacity: 500,
      status: "UPCOMING",
      organizerId: organizer.id,
      categoryId: categories[0].id,
    },
  });

  const event2 = await prisma.event.create({
    data: {
      title: "Summer Music Festival",
      description: "Three days of incredible live music featuring top artists from around the world.",
      location: "Austin, TX",
      latitude: 30.2672,
      longitude: -97.7431,
      startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 17 * 24 * 60 * 60 * 1000),
      capacity: 2000,
      status: "UPCOMING",
      organizerId: organizer.id,
      categoryId: categories[1].id,
    },
  });

  // RSVPs
  await prisma.rSVP.createMany({
    data: [
      { userId: attendee.id, eventId: event1.id, status: "GOING", note: "Really excited!" },
      { userId: admin.id, eventId: event1.id, status: "MAYBE" },
      { userId: attendee.id, eventId: event2.id, status: "GOING" },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Seed complete");
  console.log("📧 Test accounts:");
  console.log("   admin@eventsphere.com / Password123!");
  console.log("   organizer@eventsphere.com / Password123!");
  console.log("   user@eventsphere.com / Password123!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
