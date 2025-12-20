/**
 * Swagger/OpenAPI Documentation Configuration
 *
 * Provides interactive API documentation for Street Legacy 2091
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Street Legacy 2091 API',
      version: '1.0.0',
      description: `
# Street Legacy 2091 - Game API

A cyberpunk-themed MMORPG backend API providing game mechanics, real-time features, and player management.

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting
API endpoints are rate-limited to prevent abuse:
- **Global**: 100 requests per 15 minutes
- **Auth**: 5 login attempts per 15 minutes
- **Game Actions**: 30 per minute
- **Sensitive Operations**: 10 per 5 minutes

## WebSocket
Real-time features available at \`/ws\` with JWT authentication.

## Error Responses
All errors follow a consistent format:
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
\`\`\`
      `,
      contact: {
        name: 'Street Legacy Support'
      },
      license: {
        name: 'Proprietary'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.streetlegacy.com',
        description: 'Production server'
      }
    ],
    tags: [
      { name: 'Auth', description: 'Authentication and account management' },
      { name: 'Game', description: 'Core game mechanics (crimes, travel, banking)' },
      { name: 'Player', description: 'Player stats and progression' },
      { name: 'Economy', description: 'Currency, trading, and transactions' },
      { name: 'Combat', description: 'PvP, bounties, and combat systems' },
      { name: 'Crews', description: 'Crew management and crew wars' },
      { name: 'Territory', description: 'District control and territory wars' },
      { name: 'Properties', description: 'Real estate and property management' },
      { name: 'Social', description: 'Friends, chat, and social features' },
      { name: 'Events', description: 'Game events and challenges' },
      { name: 'Admin', description: 'Administrative endpoints' },
      { name: 'Health', description: 'System health and monitoring' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Error message' },
            code: { type: 'string', example: 'ERROR_CODE' },
            details: { type: 'object' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' }
          }
        },
        Player: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'CyberPunk2091' },
            level: { type: 'integer', example: 15 },
            xp: { type: 'integer', example: 12500 },
            cash: { type: 'integer', example: 50000 },
            bank: { type: 'integer', example: 250000 },
            energy: { type: 'integer', example: 100 },
            nerve: { type: 'integer', example: 100 },
            health: { type: 'integer', example: 100 },
            heat: { type: 'integer', example: 25 },
            inJail: { type: 'boolean', example: false },
            currentDistrict: { type: 'integer', example: 1 }
          }
        },
        Crime: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Pickpocket' },
            description: { type: 'string', example: 'Steal wallets from distracted citizens' },
            category: { type: 'string', example: 'theft' },
            minLevel: { type: 'integer', example: 1 },
            energyCost: { type: 'integer', example: 5 },
            baseSuccessRate: { type: 'number', example: 75 },
            minPayout: { type: 'integer', example: 50 },
            maxPayout: { type: 'integer', example: 200 }
          }
        },
        District: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Downtown' },
            city: { type: 'string', example: 'Neo Tokyo' },
            difficulty: { type: 'integer', example: 3 },
            policePresence: { type: 'integer', example: 5 },
            wealth: { type: 'integer', example: 7 }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'player1' },
            password: { type: 'string', format: 'password', example: 'SecurePass123!' }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'email', 'password', 'confirmPassword'],
          properties: {
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 20,
              example: 'NewPlayer'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'player@example.com'
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              example: 'SecurePass123!'
            },
            confirmPassword: {
              type: 'string',
              format: 'password',
              example: 'SecurePass123!'
            },
            referralCode: {
              type: 'string',
              example: 'REF123'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                player: { $ref: '#/components/schemas/Player' }
              }
            }
          }
        },
        CrimeResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                crimeSuccess: { type: 'boolean', example: true },
                cashGained: { type: 'integer', example: 150 },
                xpGained: { type: 'integer', example: 25 },
                caught: { type: 'boolean', example: false },
                jailUntil: { type: 'string', format: 'date-time', nullable: true },
                leveledUp: { type: 'boolean', example: false },
                player: { $ref: '#/components/schemas/Player' }
              }
            }
          }
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', example: 86400 },
            version: { type: 'string', example: '1.0.0' },
            components: {
              type: 'object',
              properties: {
                database: { type: 'string', enum: ['up', 'down'], example: 'up' },
                redis: { type: 'string', enum: ['up', 'down', 'not_configured'], example: 'up' },
                websocket: { type: 'string', enum: ['up', 'down'], example: 'up' }
              }
            },
            memory: {
              type: 'object',
              properties: {
                heapUsed: { type: 'integer', example: 50000000 },
                heapTotal: { type: 'integer', example: 100000000 },
                rss: { type: 'integer', example: 150000000 }
              }
            }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: 'Authentication required',
                code: 'UNAUTHORIZED'
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: 'Resource not found',
                code: 'NOT_FOUND'
              }
            }
          }
        },
        RateLimited: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: 'Too many requests, please try again later',
                code: 'RATE_LIMIT_EXCEEDED'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_FAILED',
                details: { fields: { username: 'Username is required' } }
              }
            }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.ts', './src/docs/routes/*.yaml']
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI on the Express app
 */
export function setupSwagger(app: Express): void {
  // Serve Swagger UI at /api-docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #00ff88; }
    `,
    customSiteTitle: 'Street Legacy 2091 API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true
    }
  }));

  // Serve raw OpenAPI spec as JSON
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };
