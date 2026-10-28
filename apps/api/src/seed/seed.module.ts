import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DemoSeedService } from './demo-seed.service.js';

@Module({
  imports: [PrismaModule],
  providers: [DemoSeedService],
})
export class SeedModule {}
