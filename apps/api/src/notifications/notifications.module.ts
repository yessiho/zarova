import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsGateway } from './notifications.gateway.js';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot(), AuthModule],

  controllers: [NotificationsController],

  providers: [NotificationsService, NotificationsGateway],

  exports: [NotificationsService],
})
export class NotificationsModule {}
