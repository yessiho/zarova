import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from '../prisma/prisma.module.js';

import { PaystackService } from './paystack.service.js';
import {
  PaystackController,
  PaystackWebhookController,
} from './paystack.controller.js';

@Module({
  imports: [
    /*
     * ConfigModule is global in AppModule but
     * imported here to make the dependency
     * explicit and safe if this module is
     * used in isolation (e.g. tests).
     */
    ConfigModule,

    /*
     * EventEmitterModule is registered globally
     * in AppModule via forRoot(). Importing it
     * here with forRoot() is idempotent and
     * makes the dependency explicit for tests.
     */
    EventEmitterModule.forRoot(),

    PrismaModule,
  ],

  controllers: [
    PaystackController,
    PaystackWebhookController,
  ],

  providers: [PaystackService],

  exports: [PaystackService],
})
export class PaystackModule {}
