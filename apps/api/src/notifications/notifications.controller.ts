import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

interface AuthenticatedRequest extends Request {
  user: {
    sub?: number | string;
    id?: number | string;
    userId?: number | string;
    email?: string;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  private getUserId(req: AuthenticatedRequest): number {
    const raw = req.user?.sub ?? req.user?.id ?? req.user?.userId;

    if (raw === undefined || raw === null) {
      throw new BadRequestException('Authenticated user ID is missing');
    }

    const parsed = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('Authenticated user ID is invalid');
    }

    return parsed;
  }

  /*
   * GET /notifications
   */
  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description:
      'Returns the authenticated user\'s notifications, newest first. Optionally filter by read state and paginate.',
  })
  @ApiQuery({ name: 'read', required: false, type: Boolean, description: 'Filter by read state (true / false)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (default 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Records to skip (default 0)' })
  @ApiResponse({ status: 200, description: 'Notification list returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('read') read?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = this.getUserId(req);

    const parsedRead =
      read === 'true' ? true : read === 'false' ? false : undefined;

    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    const parsedOffset = offset ? parseInt(offset, 10) : undefined;

    return this.notificationsService.findAllForUser(userId, {
      read: parsedRead,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  /*
   * GET /notifications/unread-count
   */
  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Returns the total number of unread notifications for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Unread count returned — { unreadCount: number }' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@Req() req: AuthenticatedRequest) {
    const userId = this.getUserId(req);

    const count = await this.notificationsService.getUnreadCount(userId);

    return { unreadCount: count };
  }

  /*
   * PATCH /notifications/read-all
   */
  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Bulk-marks every unread notification for the authenticated user as read.',
  })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    const userId = this.getUserId(req);

    return this.notificationsService.markAllAsRead(userId);
  }

  /*
   * PATCH /notifications/:id/read
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = this.getUserId(req);

    return this.notificationsService.markAsRead(id, userId);
  }

  /*
   * DELETE /notifications/:id
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = this.getUserId(req);

    await this.notificationsService.delete(id, userId);

    return { message: 'Notification deleted successfully' };
  }
}
