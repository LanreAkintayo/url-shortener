import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/**
 * For the schema, zod is expecting a json object;
 * Inside the object, it expects a field "body" and the value for that body is also an object which contains field "longUrl" and the value fo that "longUrl" is expected to be a valid URL string.
 
 * 
 */

export const CreateUrlSchema = z.object({
  body: z.object(
    {
      longUrl: z
        .url({ error: "Invalid URL format. Must include http:// or https://" })
        .openapi({ example: "https://google.com" }),
    },
    { error: "longUrl is required" },
  ),
});


export const UpdateUrlSchema = z.object({
  body: z.object({
    longUrl: z
      .url({ error: "Invalid URL format. Must include http:// or https://" })
      .openapi({ example: "https://google.com" }),
  }),
  params: z.object({
    shortCode: z.string().openapi({ example: "abc123" }),
  }),
});

export const RemoveUrlSchema = z.object({
  params: z.object({
    shortCode: z.string().openapi({ example: "abc123" }),
  }),
});

export const UrlResponseSchema = z.object({
  status: z.string().openapi({ example: "success" }),
  message: z.string().openapi({ example: "URL shortened successfully" }),
  data: z.object({
    id: z.number().openapi({ example: 1 }),
    longUrl: z.string().openapi({ example: "https://google.com" }),
    shortUrl: z.string().openapi({ example: "http://localhost:3000/abc123" }),
    createdAt: z.string().openapi({ example: "2024-06-01T12:00:00Z" }),
  }),
});

export const RedirectSchema = z.object({
  params: z.object({
    shortCode: z.string().openapi({ example: "abc123" }),
  }),
});

export type CreateUrlInput = z.infer<typeof CreateUrlSchema>["body"];
