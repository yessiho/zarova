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
    ...(process.env['FRONTEND_URL']
      ? [process.env['FRONTEND_URL']]
      : []),
  ];

  app.enableCors({
    origin: allowedOrigins,
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