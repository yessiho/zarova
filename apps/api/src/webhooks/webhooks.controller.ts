import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

import { CreateWebhookDto } from './dto/create-webhook.dto.js';
import { UpdateWebhookDto } from './dto/update-webhook.dto.js';
import { WebhooksService } from './webhooks.service.js';

interface AuthenticatedRequest extends Request {
  user: {
    sub?: number | string;
    id?: number | string;
    userId?: number | string;
    email?: string;
  };
}

@ApiTags('Webhooks')
@ApiBearerAuth('access-token')
@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

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
   * POST /webhooks
   */
  @Post()
  @ApiOperation({
    summary: 'Register a webhook endpoint',
    description:
      'Register a URL to receive event notifications. The response includes a signing secret used to verify delivery authenticity via the X-Zarova-Signature header.',
  })
  @ApiBody({ type: CreateWebhookDto })
  @ApiResponse({ status: 201, description: 'Webhook registered' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWebhookDto,
  ) {
    const userId = this.getUserId(req);

    return this.webhooksService.create(userId, dto);
  }

  /*
   * GET /webhooks
   */
  @Get()
  @ApiOperation({
    summary: 'List webhook endpoints',
    description:
      'Returns all webhook endpoints registered by the authenticated user. Signing secrets are never returned in list responses.',
  })
  @ApiResponse({ status: 200, description: 'List of webhooks' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Req() req: AuthenticatedRequest) {
    const userId = this.getUserId(req);

    return this.webhooksService.findAll(userId);
  }

  /*
   * GET /webhooks/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook endpoint by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = this.getUserId(req);

    return this.webhooksService.findOne(id, userId);
  }

  /*
   * PATCH /webhooks/:id
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a webhook endpoint' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateWebhookDto })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWebhookDto,
  ) {
    const userId = this.getUserId(req);

    return this.webhooksService.update(id, userId, dto);
  }

  /*
   * DELETE /webhooks/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Webhook deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = this.getUserId(req);

    await this.webhooksService.delete(id, userId);
  }

  /*
   * GET /webhooks/:id/deliveries
   */
  @Get(':id/deliveries')
  @ApiOperation({
    summary: 'Get delivery history for a webhook',
    description:
      'Returns paginated delivery attempts for the specified webhook, including HTTP status codes, response times, and retry counts.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (max 100, default 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Records to skip (default 0)' })
  @ApiResponse({ status: 200, description: 'Delivery history returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async getDeliveries(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = this.getUserId(req);

    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? parseInt(offset, 10) : undefined;

    return this.webhooksService.getDeliveries(id, userId, {
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  /*
   * POST /webhooks/:id/test
   */
  @Post(':id/test')
  @ApiOperation({
    summary: 'Send a test ping to a webhook',
    description:
      'Sends a synthetic test.ping event to verify the webhook URL is reachable. The delivery is recorded in the delivery history.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Test ping dispatched' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async sendTestPing(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = this.getUserId(req);

    return this.webhooksService.sendTestPing(id, userId);
  }
}
