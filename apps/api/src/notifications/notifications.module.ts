import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from '../prisma/prisma.module.js';

import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],

  controllers: [NotificationsController],

  providers: [NotificationsService],

  exports: [NotificationsService],
})
export class NotificationsModule {}
