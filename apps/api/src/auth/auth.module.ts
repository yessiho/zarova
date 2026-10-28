import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { EmailModule } from '../email/email.module.js';

@Global()
@Module({
  imports: [
    PrismaModule,
    UsersModule,
    EmailModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key',
      signOptions: {
        expiresIn: '15m',
      },
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService, JwtStrategy, JwtAuthGuard],

  exports: [
    AuthService,
    JwtAuthGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}