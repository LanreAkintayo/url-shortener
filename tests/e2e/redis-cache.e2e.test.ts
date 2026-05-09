// import request from "supertest";
// import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
// import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
// import { RabbitMQContainer, StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
// import { Client } from "pg";
// import { createClient } from "redis";

// let pgContainer: StartedPostgreSqlContainer;
// let redisContainer: StartedRedisContainer;
// let rmqContainer: StartedRabbitMQContainer;
// let testDbClient: Client;
// let testRedisClient: ReturnType<typeof createClient>;
// let app: any;

// beforeAll(async () => {
//   console.log("Booting containers for Cache Test...");

//   console.log("[Setup] Starting PostgreSQL container...");
//   pgContainer = await new PostgreSqlContainer("postgres:16-alpine").start();
//   console.log("[Setup] PostgreSQL ready at:", pgContainer.getConnectionUri());

//   console.log("[Setup] Starting Redis container...");
//   redisContainer = await new RedisContainer("redis:7-alpine").start();
//   console.log("[Setup] Redis ready at:", redisContainer.getConnectionUrl());

//   console.log("[Setup] Starting RabbitMQ container...");
//   rmqContainer = await new RabbitMQContainer("rabbitmq:3-management").start();
//   console.log("[Setup] RabbitMQ ready at:", rmqContainer.getAmqpUrl());

//   process.env.DATABASE_URL = pgContainer.getConnectionUri();
//   process.env.REDIS_URL = redisContainer.getConnectionUrl();
//   process.env.AMQP_URL = rmqContainer.getAmqpUrl();

//   console.log("[Setup] Connecting test DB client...");
//   testDbClient = new Client({ connectionString: process.env.DATABASE_URL });
//   await testDbClient.connect();
//   console.log("[Setup] Test DB client connected.");

//   console.log("[Setup] Creating schema...");
//   await testDbClient.query(`
//     CREATE TABLE urls (
//         id SERIAL PRIMARY KEY,
//         short_code VARCHAR(255) UNIQUE NOT NULL,
//         long_url TEXT NOT NULL,
//         created_at TIMESTAMPTZ DEFAULT NOW()
//     );
//   `);
//   console.log("[Setup] Schema created.");

//   console.log("[Setup] Seeding test data...");
//   await testDbClient.query(`
//     INSERT INTO urls (short_code, long_url) 
//     VALUES ('cache123', 'https://github.com/larrymosh');
//   `);
//   console.log("[Setup] Seed data inserted.");

//   console.log("[Setup] Connecting test Redis client...");
//   testRedisClient = createClient({ url: process.env.REDIS_URL });
//   await testRedisClient.connect();
//   console.log("[Setup] Test Redis client connected.");

//   console.log("[Setup] Importing app...");
//   app = (await import("../../src/app")).default;
//   console.log("[Setup] App imported. All systems ready.\n");
// }, 120000);

// afterAll(async () => {
//   console.log("\n[Teardown] Cleaning up containers and connections...");

//   if (testDbClient) {
//     await testDbClient.end();
//     console.log("[Teardown] DB client disconnected.");
//   }

//   if (testRedisClient) {
//     await testRedisClient.quit();
//     console.log("[Teardown] Redis client disconnected.");
//   }

//   if (pgContainer) {
//     await pgContainer.stop();
//     console.log("[Teardown] PostgreSQL container stopped.");
//   }

//   if (redisContainer) {
//     await redisContainer.stop();
//     console.log("[Teardown] Redis container stopped.");
//   }

//   if (rmqContainer) {
//     await rmqContainer.stop();
//     console.log("[Teardown] RabbitMQ container stopped.");
//   }

//   console.log("[Teardown] All containers stopped. Cleanup complete.");
// }, 30000);

// describe("Redis Cache Integration", () => {
//   it("should cache the long URL in Redis after the first request", async () => {
//     const shortCode = "cache123";
//     const redisKey = `url:${shortCode}`;

//     console.log(`[Test] Checking cache before first request for key: ${redisKey}`);
//     const cacheBefore = await testRedisClient.get(redisKey);
//     expect(cacheBefore).toBeNull();
//     console.log("[Test] Cache is empty as expected. Cache miss confirmed.");

//     console.log("[Test] Making first request...");
//     const firstResponse = await request(app).get(`/${shortCode}`);
//     expect(firstResponse.status).toBe(302);
//     expect(firstResponse.header.location).toBe("https://github.com/larrymosh");
//     console.log("[Test] First request redirected correctly to:", firstResponse.header.location);

//     console.log("[Test] Checking cache after first request...");
//     const cacheAfter = await testRedisClient.get(redisKey);
//     expect(cacheAfter).toBe("https://github.com/larrymosh");
//     console.log("[Test] Cache populated correctly:", cacheAfter);

//     console.log("[Test] Making second request to verify cache hit...");
//     const secondResponse = await request(app).get(`/${shortCode}`);
//     expect(secondResponse.status).toBe(302);
//     expect(secondResponse.header.location).toBe("https://github.com/larrymosh");
//     console.log("[Test] Second request served correctly from cache.");
//   });
// });