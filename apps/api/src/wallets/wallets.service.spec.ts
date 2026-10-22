import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { LedgerService } from '../ledger/ledger.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletsService } from './wallets.service.js';

describe('WalletsService', () => {
  let service: WalletsService;

  /* ----------------------------------------------------------
     Mock fixtures
  ---------------------------------------------------------- */

  const mockUser = {
    id: 1,
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
  };

  const mockWallet = {
    id: 1,
    userId: 1,
    currency: 'NGN',
    balance: 1000n,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAccount = {
    id: 1,
    walletId: 1,
    accountNumber: '1234567890',
    accountName: 'Test User',
    bankName: 'Zarova Virtual Bank',
    bankCode: 'ZAROVA',
    accountType: 'VIRTUAL',
    status: 'ACTIVE',
  };

  /* ----------------------------------------------------------
     Prisma mock

     `client.transaction` implementation is set in beforeEach
     (after clearAllMocks) so it re-wires every test.
  ---------------------------------------------------------- */

  const mockPrismaService = {
    client: {
      transaction: jest.fn(),
      orm: {
        public: {
          User: {
            first: jest.fn(),
          },
          WalletAccount: {
            first: jest.fn(),
            create: jest.fn(),
          },
          Wallet: {
            first: jest.fn(),
            create: jest.fn(),
            where: jest.fn(),
          },
          Transaction: {
            create: jest.fn(),
          },
        },
      },
    },
  };

  const mockLedgerService = {
    postDeposit: jest.fn(),
    postWithdrawal: jest.fn(),
    postTransfer: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService.client.transaction.mockImplementation(
      (callback: (tx: typeof mockPrismaService.client) => Promise<unknown>) =>
        callback(mockPrismaService.client),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LedgerService, useValue: mockLedgerService },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /* =====================================================
     CREATE WALLET
  ===================================================== */

  describe('create', () => {
    it('should create a new wallet successfully', async () => {
      const newWallet = {
        id: 1,
        userId: 1,
        currency: 'NGN',
        balance: 0n,
        status: 'ACTIVE',
      };

      // getWalletOwner
      mockPrismaService.client.orm.public.User.first.mockResolvedValue(mockUser);
      // no existing wallet
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue(null);
      mockPrismaService.client.orm.public.Wallet.create.mockResolvedValue(newWallet);
      // ensureWalletAccount: no existing account, account number unique
      mockPrismaService.client.orm.public.WalletAccount.first.mockResolvedValue(null);
      mockPrismaService.client.orm.public.WalletAccount.create.mockResolvedValue(mockAccount);

      const result = await service.create(1, { currency: 'NGN' });

      expect(
        mockPrismaService.client.orm.public.Wallet.first,
      ).toHaveBeenCalledWith({ userId: 1, currency: 'NGN' });

      expect(
        mockPrismaService.client.orm.public.Wallet.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, currency: 'NGN', balance: 0n, status: 'ACTIVE' }),
      );

      expect(result).toMatchObject({ ...newWallet, balance: '0' });
    });

    it('should throw ConflictException if wallet already exists', async () => {
      mockPrismaService.client.orm.public.User.first.mockResolvedValue(mockUser);
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue(mockWallet);
      mockPrismaService.client.orm.public.WalletAccount.first.mockResolvedValue(mockAccount);

      await expect(
        service.create(1, { currency: 'NGN' }),
      ).rejects.toThrow(ConflictException);

      expect(
        mockPrismaService.client.orm.public.Wallet.create,
      ).not.toHaveBeenCalled();
    });
  });

  /* =====================================================
     FIND MY WALLETS
  ===================================================== */

  describe('findMyWallets', () => {
    it('should return wallets belonging to the user', async () => {
      const userWallets = [
        { ...mockWallet, id: 1, userId: 1, balance: 1000n },
        { ...mockWallet, id: 3, userId: 1, balance: 2000n },
      ];

      // Service calls Wallet.where({userId}).all()
      mockPrismaService.client.orm.public.Wallet.where.mockReturnValue({
        all: jest.fn().mockResolvedValue(userWallets),
      });
      // ensureWalletAccount: account already exists for each wallet
      mockPrismaService.client.orm.public.WalletAccount.first.mockResolvedValue(mockAccount);

      const result = await service.findMyWallets(1);

      expect(result).toHaveLength(2);
      expect(result[0].balance).toBe('1000');
      expect(result[1].balance).toBe('2000');
    });
  });

  /* =====================================================
     DEPOSIT
  ===================================================== */

  describe('deposit', () => {
    it('should deposit money successfully', async () => {
      const updatedWallet = { ...mockWallet, balance: 1500n };

      const mockTransaction = {
        id: 10,
        amount: 500n,
        currency: 'NGN',
        destinationWalletId: 1,
        reference: 'DEP-12345',
        status: 'COMPLETED',
        _type: 'DEPOSIT',
      };

      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue(mockWallet);
      mockPrismaService.client.orm.public.Wallet.where.mockReturnValue({
        update: jest.fn().mockResolvedValue(updatedWallet),
      });
      mockPrismaService.client.orm.public.Transaction.create.mockResolvedValue(mockTransaction);
      mockLedgerService.postDeposit.mockResolvedValue(undefined);

      const result = await service.deposit(1, 1, { amount: '500' });

      expect(result.message).toBe('Deposit completed successfully');
      expect(result.wallet.balance).toBe('1500');
      expect(result.transaction.amount).toBe('500');

      expect(mockLedgerService.postDeposit).toHaveBeenCalledWith(
        mockPrismaService.client,
        10,
        500n,
        'NGN',
      );
    });

    it('should throw BadRequestException for zero deposit amount', async () => {
      await expect(
        service.deposit(1, 1, { amount: '0' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when wallet does not exist', async () => {
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue(null);

      await expect(
        service.deposit(1, 1, { amount: '500' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject deposit when user does not own wallet', async () => {
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue({
        ...mockWallet,
        userId: 2,
      });

      await expect(
        service.deposit(1, 1, { amount: '500' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject deposit when wallet is inactive', async () => {
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue({
        ...mockWallet,
        status: 'INACTIVE',
      });

      await expect(
        service.deposit(1, 1, { amount: '500' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* =====================================================
     WITHDRAW
  ===================================================== */

  describe('withdraw', () => {
    it('should withdraw money successfully', async () => {
      const updatedWallet = { ...mockWallet, balance: 500n };

      const mockTransaction = {
        id: 11,
        amount: 500n,
        currency: 'NGN',
        sourceWalletId: 1,
        reference: 'WDR-12345',
        status: 'COMPLETED',
        _type: 'WITHDRAWAL',
      };

      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue(mockWallet);
      mockPrismaService.client.orm.public.Wallet.where.mockReturnValue({
        update: jest.fn().mockResolvedValue(updatedWallet),
      });
      mockPrismaService.client.orm.public.Transaction.create.mockResolvedValue(mockTransaction);
      mockLedgerService.postWithdrawal.mockResolvedValue(undefined);

      const result = await service.withdraw(1, 1, { amount: '500' });

      expect(result.message).toBe('Withdrawal completed successfully');
      expect(result.wallet.balance).toBe('500');
      expect(result.transaction.amount).toBe('500');

      expect(mockLedgerService.postWithdrawal).toHaveBeenCalledWith(
        mockPrismaService.client,
        11,
        500n,
        'NGN',
      );
    });

    it('should reject withdrawal with insufficient balance', async () => {
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue(mockWallet);

      await expect(
        service.withdraw(1, 1, { amount: '2000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject withdrawal from inactive wallet', async () => {
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue({
        ...mockWallet,
        status: 'INACTIVE',
      });

      await expect(
        service.withdraw(1, 1, { amount: '500' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject withdrawal from another users wallet', async () => {
      // withdraw queries with {id, userId} — null means not found / unauthorized
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue(null);

      await expect(
        service.withdraw(1, 1, { amount: '500' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* =====================================================
     TRANSFER
  ===================================================== */

  describe('transfer', () => {
    it('should transfer money successfully between wallets', async () => {
      const sourceWallet = { ...mockWallet, id: 1, userId: 1, balance: 1000n };
      const destinationWallet = { ...mockWallet, id: 2, userId: 2, balance: 500n };
      const updatedSourceWallet = { ...sourceWallet, balance: 700n };
      const updatedDestinationWallet = { ...destinationWallet, balance: 800n };

      const mockTransaction = {
        id: 12,
        amount: 300n,
        currency: 'NGN',
        sourceWalletId: 1,
        destinationWalletId: 2,
        reference: 'TRF-12345',
        status: 'COMPLETED',
        _type: 'TRANSFER',
      };

      mockPrismaService.client.orm.public.Wallet.first
        .mockResolvedValueOnce(sourceWallet)
        .mockResolvedValueOnce(destinationWallet);

      mockPrismaService.client.orm.public.Wallet.where
        .mockReturnValueOnce({ update: jest.fn().mockResolvedValue(updatedSourceWallet) })
        .mockReturnValueOnce({ update: jest.fn().mockResolvedValue(updatedDestinationWallet) });

      mockPrismaService.client.orm.public.Transaction.create.mockResolvedValue(mockTransaction);
      mockLedgerService.postTransfer.mockResolvedValue(undefined);

      const result = await service.transfer(1, 1, { destinationWalletId: 2, amount: '300' });

      expect(result.message).toBe('Transfer completed successfully');
      expect(result.transaction.amount).toBe('300');
      expect(result.sourceWallet.balance).toBe('700');
      expect(result.destinationWallet.balance).toBe('800');

      expect(mockLedgerService.postTransfer).toHaveBeenCalledWith(
        mockPrismaService.client,
        12,
        300n,
        'NGN',
      );
    });

    it('should reject transfer to the same wallet', async () => {
      // Both source and destination resolve to mockWallet (id: 1)
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue(mockWallet);

      await expect(
        service.transfer(1, 1, { destinationWalletId: 1, amount: '100' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transfer when source wallet does not exist', async () => {
      mockPrismaService.client.orm.public.Wallet.first.mockResolvedValue(null);

      await expect(
        service.transfer(1, 1, { destinationWalletId: 2, amount: '100' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject transfer with different currencies', async () => {
      const sourceWallet = { ...mockWallet, currency: 'NGN' };
      const destinationWallet = { ...mockWallet, id: 2, currency: 'USD' };

      mockPrismaService.client.orm.public.Wallet.first
        .mockResolvedValueOnce(sourceWallet)
        .mockResolvedValueOnce(destinationWallet);

      await expect(
        service.transfer(1, 1, { destinationWalletId: 2, amount: '100' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transfer with insufficient balance', async () => {
      const sourceWallet = { ...mockWallet, balance: 100n };
      const destinationWallet = { ...mockWallet, id: 2, balance: 500n };

      mockPrismaService.client.orm.public.Wallet.first
        .mockResolvedValueOnce(sourceWallet)
        .mockResolvedValueOnce(destinationWallet);

      await expect(
        service.transfer(1, 1, { destinationWalletId: 2, amount: '500' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
