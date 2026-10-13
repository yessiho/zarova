import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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

import { WalletsService } from './wallets.service.js';

import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { DepositDto } from './dto/deposit.dto.js';
import { WithdrawDto } from './dto/withdraw.dto.js';
import { TransferDto } from './dto/transfer.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface AuthenticatedRequest extends Request {
  user: {
    id?: number | string;
    userId?: number | string;
    email: string;
    firstName?: string;
    lastName?: string;
    status?: string;
    type?: 'USER' | 'ADMIN';
  };
}

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
  ) {}

  /*
   * ==========================================
   * GET AUTHENTICATED USER ID
   *
   * Security:
   * - Supports id and userId for compatibility
   * - Converts numeric strings safely
   * - Rejects invalid IDs
   * - Prevents wallet operations without
   *   a valid authenticated user ID
   * ==========================================
   */
  private getUserId(
    req: AuthenticatedRequest,
  ): number {
    const rawUserId =
      req.user?.id ?? req.user?.userId;

    if (
      rawUserId === undefined ||
      rawUserId === null ||
      rawUserId === ''
    ) {
      throw new BadRequestException(
        'Authenticated user ID is missing',
      );
    }

    const userId = Number(rawUserId);

    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      throw new BadRequestException(
        'Authenticated user ID is invalid',
      );
    }

    return userId;
  }

  /*
   * ==========================================
   * CREATE WALLET
   * POST /wallets
   * ==========================================
   */
  @Post()
  @ApiOperation({ summary: 'Create a new wallet for the authenticated user' })
  @ApiBody({ type: CreateWalletDto })
  @ApiResponse({ status: 201, description: 'Wallet created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @Req()
    req: AuthenticatedRequest,
    @Body()
    createWalletDto: CreateWalletDto,
  ) {
    const userId = this.getUserId(req);

    return this.walletsService.create(
      userId,
      createWalletDto,
    );
  }

  /*
   * ==========================================
   * GET MY WALLETS
   * GET /wallets
   * ==========================================
   */
  @Get()
  @ApiOperation({ summary: 'Get all wallets belonging to the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of user wallets returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findMyWallets(
    @Req()
    req: AuthenticatedRequest,
  ) {
    const userId = this.getUserId(req);

    return this.walletsService.findMyWallets(
      userId,
    );
  }

  /*
   * ==========================================
   * FIND TRANSFER RECIPIENT
   *
   * GET /wallets/recipient?accountNumber=...
   *
   * Account number is used as the recipient
   * identifier.
   * ==========================================
   */
  @Get('recipient')
  @ApiOperation({ summary: 'Find a transfer recipient by account number' })
  @ApiQuery({ name: 'accountNumber', required: true, type: String, description: 'Recipient wallet account number' })
  @ApiResponse({ status: 200, description: 'Recipient found successfully' })
  @ApiResponse({ status: 400, description: 'Missing or invalid account number' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Recipient not found' })
  findTransferRecipient(
    @Req()
    req: AuthenticatedRequest,
    @Query('accountNumber')
    accountNumber: string,
  ) {
    const userId = this.getUserId(req);

    return this.walletsService.findTransferRecipient(
      userId,
      accountNumber,
    );
  }

  /*
   * ==========================================
   * GET WALLET ACCOUNT
   * GET /wallets/:id/account
   *
   * Security:
   * The authenticated user ID is explicitly
   * passed to the service.
   *
   * The service must verify:
   *
   * wallet.id === walletId
   * AND
   * wallet.userId === userId
   * ==========================================
   */
  @Get(':id/account')
  @ApiOperation({ summary: 'Get account details for a specific wallet' })
  @ApiParam({ name: 'id', type: Number, description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Wallet account details returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid wallet ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Wallet does not belong to the authenticated user' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  getWalletAccount(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', ParseIntPipe)
    walletId: number,
  ) {
    const userId = this.getUserId(req);

    console.log(
      'WALLET ACCOUNT AUTH CHECK:',
      {
        authenticatedUserId: userId,
        requestedWalletId: walletId,
        authenticatedUser: {
          id: req.user?.id,
          userId: req.user?.userId,
          email: req.user?.email,
          type: req.user?.type,
        },
      },
    );

    return this.walletsService.getWalletAccount(
      userId,
      walletId,
    );
  }

  /*
   * ==========================================
   * GET SINGLE WALLET
   * GET /wallets/:id
   *
   * Security:
   * Service must verify wallet ownership.
   * ==========================================
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single wallet by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Wallet returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid wallet ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Wallet does not belong to the authenticated user' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  findOne(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', ParseIntPipe)
    walletId: number,
  ) {
    const userId = this.getUserId(req);

    return this.walletsService.findOne(
      userId,
      walletId,
    );
  }

  /*
   * ==========================================
   * DEPOSIT MONEY
   * POST /wallets/:id/deposit
   *
   * Security:
   * Deposit must only operate on a wallet
   * belonging to the authenticated user.
   * ==========================================
   */
  @Post(':id/deposit')
  @ApiOperation({ summary: 'Deposit money into a wallet' })
  @ApiParam({ name: 'id', type: Number, description: 'Wallet ID to deposit into' })
  @ApiBody({ type: DepositDto })
  @ApiResponse({ status: 200, description: 'Deposit completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid deposit data or wallet ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Wallet does not belong to the authenticated user' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  deposit(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', ParseIntPipe)
    walletId: number,
    @Body()
    depositDto: DepositDto,
  ) {
    const userId = this.getUserId(req);

    return this.walletsService.deposit(
      userId,
      walletId,
      depositDto,
    );
  }

  /*
   * ==========================================
   * WITHDRAW MONEY
   * POST /wallets/:id/withdraw
   *
   * Security:
   * Withdrawal must only operate on a wallet
   * belonging to the authenticated user.
   * ==========================================
   */
  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw money from a wallet' })
  @ApiParam({ name: 'id', type: Number, description: 'Wallet ID to withdraw from' })
  @ApiBody({ type: WithdrawDto })
  @ApiResponse({ status: 200, description: 'Withdrawal completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid withdrawal data, insufficient funds, or invalid wallet ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Wallet does not belong to the authenticated user' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  withdraw(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', ParseIntPipe)
    walletId: number,
    @Body()
    withdrawDto: WithdrawDto,
  ) {
    const userId = this.getUserId(req);

    return this.walletsService.withdraw(
      userId,
      walletId,
      withdrawDto,
    );
  }

  /*
   * ==========================================
   * TRANSFER MONEY
   * POST /wallets/:id/transfer
   *
   * Security:
   * Source wallet must belong to the
   * authenticated user.
   * ==========================================
   */
  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transfer money from a wallet to a recipient wallet' })
  @ApiParam({ name: 'id', type: Number, description: 'Source wallet ID' })
  @ApiBody({ type: TransferDto })
  @ApiResponse({ status: 200, description: 'Transfer completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transfer data, insufficient funds, or invalid wallet ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Source wallet does not belong to the authenticated user' })
  @ApiResponse({ status: 404, description: 'Source or destination wallet not found' })
  transfer(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', ParseIntPipe)
    sourceWalletId: number,
    @Body()
    transferDto: TransferDto,
  ) {
    const userId = this.getUserId(req);

    return this.walletsService.transfer(
      userId,
      sourceWalletId,
      transferDto,
    );
  }
}
