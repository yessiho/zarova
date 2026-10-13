import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RequirePermissions } from './rbac.decorator.js';
import { PERMISSION_CODES } from './rbac.constants.js';
import { RbacGuard } from './rbac.guard.js';
import { AdminRoleAssignmentService } from './admin-role-assignment.service.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    type?: string;
  };
}

@ApiTags('Admin Role Assignment')
@ApiBearerAuth('access-token')
@UseGuards(RbacGuard)
@Controller('admin')
export class AdminRoleAssignmentController {
  constructor(
    private readonly roleAssignmentService: AdminRoleAssignmentService,
  ) {}

  @Get('roles')
  @RequirePermissions(PERMISSION_CODES.ROLE_VIEW)
  @ApiOperation({
    summary: 'List available roles',
    description: 'Returns all active roles that can be assigned to administrators.',
  })
  @ApiResponse({ status: 200, description: 'List of available roles' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getAvailableRoles() {
    return this.roleAssignmentService.getAvailableRoles();
  }

  @Get(':adminId/roles')
  @RequirePermissions(PERMISSION_CODES.ROLE_VIEW)
  @ApiOperation({
    summary: 'Get roles assigned to an administrator',
    description: 'Returns the active role assignments for a specific admin account.',
  })
  @ApiParam({ name: 'adminId', type: Number })
  @ApiResponse({ status: 200, description: 'Admin role assignments returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async getAdminRoles(
    @Param('adminId', ParseIntPipe) adminId: number,
  ) {
    return this.roleAssignmentService.getAdminRoles(adminId);
  }

  @Post(':adminId/roles/:roleId')
  @RequirePermissions(PERMISSION_CODES.ROLE_ASSIGN)
  @ApiOperation({
    summary: 'Assign a role to an administrator',
    description:
      'Grants a role to an admin account. The acting administrator is taken from the authenticated JWT. The assignment is audit-logged.',
  })
  @ApiParam({ name: 'adminId', type: Number })
  @ApiParam({ name: 'roleId', type: Number })
  @ApiResponse({ status: 201, description: 'Role assigned' })
  @ApiResponse({ status: 400, description: 'Role already assigned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Admin or role not found' })
  async assignRole(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const performedByAdminId = Number(request.user?.id);

    return this.roleAssignmentService.assignRole(
      adminId,
      roleId,
      performedByAdminId,
    );
  }

  @Delete(':adminId/roles/:roleId')
  @RequirePermissions(PERMISSION_CODES.ROLE_ASSIGN)
  @ApiOperation({
    summary: 'Remove a role from an administrator',
    description: 'Deactivates a role assignment. The action is audit-logged.',
  })
  @ApiParam({ name: 'adminId', type: Number })
  @ApiParam({ name: 'roleId', type: Number })
  @ApiResponse({ status: 200, description: 'Role removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async removeRole(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const performedByAdminId = Number(request.user?.id);

    return this.roleAssignmentService.removeRole(
      adminId,
      roleId,
      performedByAdminId,
    );
  }
}
