import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from '../prisma/prisma.module.js';

import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],

  controllers: [WebhooksController],

  providers: [WebhooksService],

  exports: [WebhooksService],
})
export class WebhooksModule {}
