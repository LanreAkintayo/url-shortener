import { registry } from './swagger';
import { 
    CreateUrlSchema, 
    UrlResponseSchema, 
    RedirectSchema,
    UpdateUrlSchema,
    RemoveUrlSchema 
} from '../types/url.types';

export function registerUrlRoutes() {
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

    // registry.registerPath({
    //     method: 'get',
    //     path: '/{shortCode}',
    //     summary: 'Redirect to original URL',
    //     request: {
    //         params: RedirectSchema.shape.params,
    //     },
    //     responses: {
    //         301: {
    //             description: 'Redirecting to original URL',
    //         },
    //         404: {
    //             description: 'Short URL not found',
    //         },
    //     },
    // });

    registry.registerPath({
        method: 'put',
        path: '/{shortCode}',
        summary: 'Update an existing short URL',
        request: {
            params: UpdateUrlSchema.shape.params,
            body: {
                content: {
                    'application/json': {
                        schema: UpdateUrlSchema.shape.body,
                    },
                },
            },
        },
        responses: {
            200: {
                description: 'URL updated successfully',
                content: {
                    'application/json': {
                        schema: UrlResponseSchema,
                    },
                },
            },
            400: {
                description: 'Validation failed',
            },
            404: {
                description: 'Short URL not found',
            },
        },
    });

    registry.registerPath({
        method: 'delete',
        path: '/{shortCode}',
        summary: 'Delete a short URL',
        request: {
            params: RemoveUrlSchema.shape.params,
        },
        responses: {
            204: {
                description: 'URL deleted successfully',
            },
            404: {
                description: 'Short URL not found',
            },
        },
    });
}