import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";

export const registry = new OpenAPIRegistry();

export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "URL Shortener API",
      version: "1.0.0",
      description: "A simple URL shortener API with Redis Caching and KGS",
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? `${process.env.SHORTENER_URL}/api` || "localhost:8080/api"
            : `${process.env.BASE_URL}/api` || "http://localhost:8080/api",
        description: "Shortener server",
      },
    ],
  });
}
