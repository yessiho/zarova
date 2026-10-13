import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';


import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { PaystackService } from './paystack.service.js';
import { InitializePaymentDto } from './dto/initialize-payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AuthThrottle } from '../throttler/throttle.decorator.js';

/*
 * ==========================================
 * AUTHENTICATED REQUEST SHAPE
 *
 * The JWT strategy returns req.user with
 * an id field (not sub).
 * ==========================================
 */
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    status?: string;
    type?: 'USER' | 'ADMIN';
  };
}

/*
 * ==========================================
 * PAYSTACK CONTROLLER
 *
 * Protected routes — all require a valid
 * JWT token.
 *
 * @Controller('paystack')
 * ==========================================
 */
@ApiTags('Paystack')
@ApiBearerAuth('access-token')
@Controller('paystack')
@UseGuards(JwtAuthGuard)
export class PaystackController {
  constructor(
    private readonly paystackService: PaystackService,
  ) {}

  /*
   * ==========================================
   * EXTRACT AUTHENTICATED USER ID
   * ==========================================
   */
  private getUserId(
    req: AuthenticatedRequest,
  ): number {
    const userId = req.user?.id;

    if (
      userId === undefined ||
      userId === null
    ) {
      throw new BadRequestException(
        'Authenticated user ID is missing',
      );
    }

    const parsed = Number(userId);

    if (
      !Number.isSafeInteger(parsed) ||
      parsed <= 0
    ) {
      throw new BadRequestException(
        'Authenticated user ID is invalid',
      );
    }

    return parsed;
  }

  /*
   * ==========================================
   * INITIALIZE PAYMENT
   *
   * POST /paystack/initialize
   *
   * Rate-limited via AuthThrottle.
   * ==========================================
   */
  @Post('initialize')
  @AuthThrottle()
  @ApiOperation({ summary: 'Initialize a Paystack payment' })
  @ApiBody({ type: InitializePaymentDto })
  @ApiResponse({ status: 201, description: 'Payment initialized — returns authorizationUrl' })
  @ApiResponse({ status: 400, description: 'Invalid request data or inactive wallet' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  initializePayment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InitializePaymentDto,
  ) {
    const userId = this.getUserId(req);
    const userEmail = req.user.email;

    return this.paystackService.initializePayment(
      userId,
      userEmail,
      dto,
    );
  }

  /*
   * ==========================================
   * VERIFY PAYMENT
   *
   * POST /paystack/verify/:reference
   *
   * Called by the frontend after returning
   * from the Paystack hosted checkout page.
   * ==========================================
   */
  @Post('verify/:reference')
  @ApiOperation({ summary: 'Verify a Paystack payment after redirect' })
  @ApiParam({ name: 'reference', type: String, description: 'Payment reference' })
  @ApiResponse({ status: 200, description: 'Payment verified and transaction updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  verifyPayment(
    @Req() req: AuthenticatedRequest,
    @Param('reference') reference: string,
  ) {
    const userId = this.getUserId(req);

    return this.paystackService.verifyPayment(
      reference,
      userId,
    );
  }

  /*
   * ==========================================
   * LIST ALL TRANSACTIONS
   *
   * GET /paystack
   * ==========================================
   */
  @Get()
  @ApiOperation({ summary: 'List all Paystack transactions for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of transactions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = this.getUserId(req);

    return this.paystackService.findAllForUser(userId);
  }

  /*
   * ==========================================
   * GET SINGLE TRANSACTION
   *
   * GET /paystack/:reference
   * ==========================================
   */
  @Get(':reference')
  @ApiOperation({ summary: 'Get a single Paystack transaction by reference' })
  @ApiParam({ name: 'reference', type: String, description: 'Payment reference' })
  @ApiResponse({ status: 200, description: 'Transaction detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('reference') reference: string,
  ) {
    const userId = this.getUserId(req);

    return this.paystackService.findOne(
      reference,
      userId,
    );
  }
}

/*
 * ==========================================
 * PAYSTACK WEBHOOK CONTROLLER
 *
 * This is a SEPARATE controller so that
 * JwtAuthGuard is never applied to
 * POST /paystack/webhook.
 *
 * NestFactory is started with rawBody: true
 * (see main.ts), which populates req.rawBody.
 * ==========================================
 */
@ApiTags('Paystack')
@Controller('paystack/webhook')
export class PaystackWebhookController {
  private readonly paystackService: PaystackService;

  constructor(paystackService: PaystackService) {
    this.paystackService = paystackService;
  }

  /*
   * ==========================================
   * RECEIVE WEBHOOK
   *
   * POST /paystack/webhook
   *
   * Public — no auth guard.
   * Verifies HMAC-SHA512 before processing.
   * ==========================================
   */
  @Post()
  @ApiOperation({ summary: 'Receive Paystack webhook events (public endpoint)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleWebhook(
    @Headers('x-paystack-signature') signature: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Req() req: any,
  ) {
    const rawBody: Buffer | undefined = req.rawBody;

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException(
        'Raw body is unavailable — ensure rawBody: true in NestFactory.create()',
      );
    }

    await this.paystackService.handleWebhook(
      signature ?? '',
      rawBody,
    );

    return { received: true };
  }
}
