import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';

import { Request } from 'express';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

import { TwoFactorService } from './two-factor.service.js';

interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    email: string;
    type: string;
  };
}

@ApiTags('Two-Factor Authentication')
@ApiBearerAuth('access-token')
@Controller('auth/2fa')
@UseGuards(JwtAuthGuard)
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('setup')
  @ApiOperation({
    summary: 'Generate 2FA setup',
    description:
      'Generates a new TOTP secret, QR code URI, and backup codes. 2FA is not enabled until /enable is called with a valid TOTP token.',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns { qrCode, secret, backupCodes }',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setup(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;

    return this.twoFactorService.generateSetup(userId);
  }

  @Post('enable')
  @ApiOperation({
    summary: 'Enable 2FA',
    description:
      'Verifies the TOTP token from the authenticator app and enables 2FA for the account.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { token: { type: 'string', example: '123456' } },
      required: ['token'],
    },
  })
  @ApiResponse({ status: 201, description: '2FA enabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired TOTP token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async enable(
    @Req() req: AuthenticatedRequest,
    @Body() body: { token: string },
  ) {
    const userId = req.user.sub;

    return this.twoFactorService.verifyAndEnable(userId, body.token);
  }

  @Post('disable')
  @ApiOperation({
    summary: 'Disable 2FA',
    description: 'Verifies the current TOTP token and removes all 2FA data from the account.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { token: { type: 'string', example: '123456' } },
      required: ['token'],
    },
  })
  @ApiResponse({ status: 201, description: '2FA disabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired TOTP token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async disable(
    @Req() req: AuthenticatedRequest,
    @Body() body: { token: string },
  ) {
    const userId = req.user.sub;

    return this.twoFactorService.disable(userId, body.token);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get 2FA status',
    description: 'Returns whether 2FA is currently enabled for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns { enabled: boolean, hasSecret: boolean }',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async status(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;

    return this.twoFactorService.getStatus(userId);
  }
}
