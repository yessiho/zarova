import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { RequirePermissions } from '../rbac/rbac.decorator.js';
import { PERMISSION_CODES } from '../rbac/rbac.constants.js';
import { RbacGuard } from '../rbac/rbac.guard.js';

import { SystemSettingsService } from './system-settings.service.js';

class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  value!: string;
}

type AdminRequest = Request & { user: { id: number } };

@ApiTags('Admin Settings')
@ApiBearerAuth('access-token')
@Controller('admin/settings')
@UseGuards(RbacGuard)
export class SystemSettingsController {
  constructor(private readonly service: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system settings grouped by category' })
  @RequirePermissions(PERMISSION_CODES.SYSTEM_SETTINGS_VIEW)
  findAll() {
    return this.service.findAll();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a single system setting by key' })
  @RequirePermissions(PERMISSION_CODES.SYSTEM_SETTINGS_UPDATE)
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @Req() req: AdminRequest,
  ) {
    const adminId = req.user?.id;
    return this.service.update(key, dto.value, adminId);
  }
}
