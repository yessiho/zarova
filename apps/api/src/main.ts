import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Required for webhook signature verification (Paystack, etc.)
    rawBody: true,
  });

  /*
   * ==========================================
   * CORS CONFIGURATION
   * ==========================================
   */
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    ...(process.env['FRONTEND_URL']
      ? [process.env['FRONTEND_URL']]
      : []),
    ...(process.env['API_URL']
      ? [process.env['API_URL']]
      : []),
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (curl, mobile apps without browser)
      if (!origin) return callback(null, true);
      // Allow explicitly listed origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow all Vercel preview deployments for this project
      if (/^https:\/\/zarova(-[a-z0-9]+)*-yessihos-projects\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  /*
   * ==========================================
   * GLOBAL VALIDATION
   * ==========================================
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /*
   * ==========================================
   * SWAGGER API DOCUMENTATION
   * ==========================================
   */
  const config = new DocumentBuilder()
    .setTitle('Zarova API')
    .setDescription(
      'API documentation for the Zarova financial platform',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
      'access-token',
    )
    .addSecurityRequirements('access-token')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document);

  /*
   * ==========================================
   * START APPLICATION
   *
   * Backend API runs on port 3001.
   * Frontend Next.js runs on port 3000.
   * ==========================================
   */
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();