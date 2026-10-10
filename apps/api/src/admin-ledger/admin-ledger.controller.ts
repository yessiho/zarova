import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  RequirePermissions,
} from '../rbac/rbac.decorator.js';

import {
  PERMISSION_CODES,
} from '../rbac/rbac.constants.js';

import {
  RbacGuard,
} from '../rbac/rbac.guard.js';

import {
  AdminLedgerService,
} from './admin-ledger.service.js';

@ApiTags('Admin Ledger')
@ApiBearerAuth('access-token')
@Controller('admin/ledger')
@UseGuards(RbacGuard)
export class AdminLedgerController {
  constructor(
    private readonly adminLedgerService: AdminLedgerService,
  ) {}

  /* ==========================================================
     GET /admin/ledger/accounts
     ========================================================== */

  @Get('accounts')
  @RequirePermissions(
    PERMISSION_CODES.LEDGER_VIEW,
  )
  @ApiOperation({
    summary:
      'Get all ledger accounts for administrators',
  })
  findAll() {
    return this.adminLedgerService.findAll();
  }

  /* ==========================================================
     GET /admin/ledger/accounts/:id
     ========================================================== */

  @Get('accounts/:id')
  @RequirePermissions(
    PERMISSION_CODES.LEDGER_VIEW,
  )
  @ApiOperation({
    summary:
      'Get ledger account details for administrators',
  })
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.adminLedgerService.findOne(
      id,
    );
  }
}