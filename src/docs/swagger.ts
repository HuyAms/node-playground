import { OpenAPIV3 } from 'openapi-types';

export const swaggerSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Users API',
    version: '1.0.0',
    description:
      'Enterprise-grade REST API demonstrating feature-based modular architecture with TypeScript, Zod validation, structured logging, and paginated resources.',
    contact: {
      name: 'Backend Engineering',
    },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
  ],
  tags: [{ name: 'Users', description: 'User management endpoints' }],
  paths: {
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        description: 'Returns a paginated list of users.',
        operationId: 'listUsers',
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number (1-indexed)',
            schema: { type: 'integer', default: 1, minimum: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page (max 100)',
            schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated list of users',
            headers: {
              'x-request-id': {
                schema: { type: 'string' },
                description: 'Correlation ID for tracing',
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedUsers' },
                example: {
                  data: [
                    {
                      id: '11111111-0000-0000-0000-000000000001',
                      name: 'Alice Nguyen',
                      email: 'alice@example.com',
                      role: 'admin',
                      createdAt: '2024-01-10T08:00:00.000Z',
                      updatedAt: '2024-01-10T08:00:00.000Z',
                    },
                  ],
                  meta: { page: 1, limit: 10, total: 10, totalPages: 1 },
                },
              },
            },
          },
          '422': { $ref: '#/components/responses/ValidationError' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create a user',
        operationId: 'createUser',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserInput' },
              example: { name: 'Jane Doe', email: 'jane@example.com', role: 'editor' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
          '409': { $ref: '#/components/responses/ConflictError' },
          '422': { $ref: '#/components/responses/ValidationError' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/users/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'User ID (UUID)',
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      get: {
        tags: ['Users'],
        summary: 'Get user by ID',
        operationId: 'getUserById',
        responses: {
          '200': {
            description: 'User found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Partially update a user',
        operationId: 'updateUser',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateUserInput' },
              example: { name: 'Jane Smith' },
            },
          },
        },
        responses: {
          '200': {
            description: 'User updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '409': { $ref: '#/components/responses/ConflictError' },
          '422': { $ref: '#/components/responses/ValidationError' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete a user',
        operationId: 'deleteUser',
        responses: {
          '204': { description: 'User deleted' },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
  },
  components: {
    schemas: {
      UserRole: {
        type: 'string',
        enum: ['admin', 'editor', 'viewer'],
        description: 'User role within the system',
      },
      User: {
        type: 'object',
        required: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', format: 'uuid', example: '11111111-0000-0000-0000-000000000001' },
          name: { type: 'string', example: 'Alice Nguyen' },
          email: { type: 'string', format: 'email', example: 'alice@example.com' },
          role: { $ref: '#/components/schemas/UserRole' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateUserInput: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100, example: 'Jane Doe' },
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          role: { $ref: '#/components/schemas/UserRole' },
        },
      },
      UpdateUserInput: {
        type: 'object',
        description: 'At least one field is required',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          role: { $ref: '#/components/schemas/UserRole' },
        },
      },
      PaginationMeta: {
        type: 'object',
        required: ['page', 'limit', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 5 },
        },
      },
      PaginatedUsers: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/User' },
          },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                enum: [
                  'RESOURCE_NOT_FOUND',
                  'VALIDATION_ERROR',
                  'CONFLICT',
                  'INTERNAL_SERVER_ERROR',
                ],
              },
              message: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
                description: 'Field-level validation errors (422 only)',
              },
              requestId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
    },
    responses: {
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              error: {
                code: 'RESOURCE_NOT_FOUND',
                message: "User with id 'abc' not found",
                requestId: 'e3b0c442-98fc-1234-b473-c0a8c0d0e001',
              },
            },
          },
        },
      },
      ValidationError: {
        description: 'Request validation failed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: [{ field: 'email', message: 'email must be a valid email address' }],
                requestId: 'e3b0c442-98fc-1234-b473-c0a8c0d0e002',
              },
            },
          },
        },
      },
      ConflictError: {
        description: 'Conflict with existing resource',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              error: {
                code: 'CONFLICT',
                message: "A user with email 'alice@example.com' already exists",
                requestId: 'e3b0c442-98fc-1234-b473-c0a8c0d0e003',
              },
            },
          },
        },
      },
      InternalError: {
        description: 'Unexpected server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
                requestId: 'e3b0c442-98fc-1234-b473-c0a8c0d0e004',
              },
            },
          },
        },
      },
    },
  },
};
