import { registry } from './swagger';
import { CreateUrlSchema, UrlResponseSchema, RedirectSchema } from '../types/url.types';

export function registerUrlRoutes() {
    // POST /shorten
    registry.registerPath({
        method: 'post',
        path: '/shorten',
        summary: 'Shorten a URL',
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: CreateUrlSchema.shape.body,
                    },
                },
            },
        },
        responses: {
            200: {
                description: 'URL shortened successfully',
                content: {
                    'application/json': {
                        schema: UrlResponseSchema,
                    },
                },
            },
            400: {
                description: 'Validation failed',
            },
        },
    });

    // GET /:shortCode
    registry.registerPath({
        method: 'get',
        path: '/{shortCode}',
        summary: 'Redirect to original URL',
        request: {
            params: RedirectSchema.shape.params,
        },
        responses: {
            301: {
                description: 'Redirecting to original URL',
            },
            404: {
                description: 'Short URL not found',
            },
        },
    });
}