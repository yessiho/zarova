import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';

/* =====================================================
   MOCK BCRYPT BEFORE IMPORTING AUTHSERVICE
===================================================== */

const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();

jest.unstable_mockModule('bcrypt', () => ({
  hash: mockBcryptHash,
  compare: mockBcryptCompare,
}));

/* =====================================================
   DYNAMICALLY IMPORT AUTH SERVICE
===================================================== */

const { AuthService } = await import('./auth.service.js');

// =====================================================
// SHARED MOCKS
// =====================================================

const mockUser = {
  id: 1,
  email: 'john@test.com',
  passwordHash: 'hashed-password',
  firstName: 'John',
  lastName: 'Doe',
  status: 'ACTIVE',
};

const mockAdmin = {
  id: 1,
  email: 'admin@test.com',
  passwordHash: 'hashed-admin-password',
  firstName: 'Super',
  lastName: 'Admin',
  status: 'ACTIVE',
};

const makePrisma = () => ({
  client: {
    orm: {
      public: {
        User: {
          first: jest.fn(),
          create: jest.fn(),
          where: jest.fn().mockReturnValue({ update: jest.fn() }),
        },
        Admin: {
          first: jest.fn(),
          create: jest.fn(),
        },
      },
    },
  },
});

const makeJwt = () => ({ signAsync: jest.fn() });
const makeEmail = () => ({
  sendPasswordResetEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
});

// =====================================================
// TESTS
// =====================================================

describe('AuthService', () => {
  let service: InstanceType<typeof AuthService>;
  let mockPrisma: ReturnType<typeof makePrisma>;
  let mockJwt: ReturnType<typeof makeJwt>;
  let mockEmail: ReturnType<typeof makeEmail>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma = makePrisma();
    mockJwt = makeJwt();
    mockEmail = makeEmail();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ===================================================
  // USER LOGIN
  // ===================================================

  describe('userLogin', () => {
    it('returns access token and user on valid credentials', async () => {
      mockPrisma.client.orm.public.User.first.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockJwt.signAsync.mockResolvedValue('mock-token');

      const result = await service.userLogin({ email: 'john@test.com', password: 'Password123' });

      expect(mockPrisma.client.orm.public.User.first).toHaveBeenCalledWith({ email: 'john@test.com' });
      expect(mockBcryptCompare).toHaveBeenCalledWith('Password123', 'hashed-password');
      expect(mockJwt.signAsync).toHaveBeenCalledWith({ sub: 1, email: 'john@test.com', type: 'USER' });
      expect(result).toEqual({
        accessToken: 'mock-token',
        user: { id: 1, email: 'john@test.com', firstName: 'John', lastName: 'Doe', status: 'ACTIVE' },
      });
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      mockPrisma.client.orm.public.User.first.mockResolvedValue(null);

      await expect(service.userLogin({ email: 'ghost@test.com', password: 'x' }))
        .rejects.toThrow(UnauthorizedException);

      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      mockPrisma.client.orm.public.User.first.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false);

      await expect(service.userLogin({ email: 'john@test.com', password: 'bad' }))
        .rejects.toThrow(UnauthorizedException);

      expect(mockJwt.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when user account is suspended', async () => {
      mockPrisma.client.orm.public.User.first.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });

      await expect(service.userLogin({ email: 'john@test.com', password: 'Password123' }))
        .rejects.toThrow(UnauthorizedException);

      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });
  });

  // ===================================================
  // ADMIN LOGIN
  // ===================================================

  describe('adminLogin', () => {
    it('returns access token and admin on valid credentials', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(mockAdmin);
      mockBcryptCompare.mockResolvedValue(true);
      mockJwt.signAsync.mockResolvedValue('admin-token');

      const result = await service.adminLogin({ email: 'admin@test.com', password: 'Admin@1234' });

      expect(mockJwt.signAsync).toHaveBeenCalledWith({ sub: 1, email: 'admin@test.com', type: 'ADMIN' });
      expect(result.accessToken).toBe('admin-token');
      expect(result.admin.email).toBe('admin@test.com');
    });

    it('throws UnauthorizedException when admin does not exist', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(null);

      await expect(service.adminLogin({ email: 'nobody@test.com', password: 'x' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when admin account is suspended', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue({ ...mockAdmin, status: 'SUSPENDED' });

      await expect(service.adminLogin({ email: 'admin@test.com', password: 'Admin@1234' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(mockAdmin);
      mockBcryptCompare.mockResolvedValue(false);

      await expect(service.adminLogin({ email: 'admin@test.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // ===================================================
  // ADMIN REGISTER
  // ===================================================

  describe('adminRegister', () => {
    it('creates and returns a new admin', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(null);
      mockBcryptHash.mockResolvedValue('hashed-pw');
      mockPrisma.client.orm.public.Admin.create.mockResolvedValue({
        id: 2,
        email: 'new@admin.com',
        firstName: 'New',
        lastName: 'Admin',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
      });

      const result = await service.adminRegister({
        email: 'new@admin.com',
        password: 'Admin@1234',
        firstName: 'New',
        lastName: 'Admin',
      });

      expect(mockBcryptHash).toHaveBeenCalledWith('Admin@1234', 12);
      expect(result.email).toBe('new@admin.com');
    });

    it('throws ConflictException when admin email already exists', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(mockAdmin);

      await expect(service.adminRegister({
        email: 'admin@test.com',
        password: 'Admin@1234',
        firstName: 'Dup',
        lastName: 'Admin',
      })).rejects.toThrow(ConflictException);

      expect(mockPrisma.client.orm.public.Admin.create).not.toHaveBeenCalled();
    });

    it('normalizes the email to lowercase', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(null);
      mockBcryptHash.mockResolvedValue('hashed-pw');
      mockPrisma.client.orm.public.Admin.create.mockResolvedValue({
        id: 3,
        email: 'upper@admin.com',
        firstName: 'A',
        lastName: 'B',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
      });

      await service.adminRegister({
        email: '  UPPER@ADMIN.COM  ',
        password: 'Admin@1234',
        firstName: 'A',
        lastName: 'B',
      });

      expect(mockPrisma.client.orm.public.Admin.first).toHaveBeenCalledWith({ email: 'upper@admin.com' });
    });
  });

  // ===================================================
  // FORGOT PASSWORD
  // ===================================================

  describe('forgotPassword', () => {
    it('returns success message even when email does not exist', async () => {
      mockPrisma.client.orm.public.User.first.mockResolvedValue(null);

      const result = await service.forgotPassword('ghost@test.com');

      expect(result.message).toContain('If an account exists');
      expect(mockEmail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('stores a hashed token and calls emailService when user exists', async () => {
      const updateMock = jest.fn().mockResolvedValue({});
      mockPrisma.client.orm.public.User.where = jest.fn().mockReturnValue({ update: updateMock });
      mockPrisma.client.orm.public.User.first.mockResolvedValue(mockUser);
      mockEmail.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword('john@test.com');

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ passwordResetToken: expect.any(String) }),
      );
      expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalledWith(
        'john@test.com',
        'John',
        expect.any(String),
        expect.stringContaining('/reset-password?token='),
      );
      expect(result.message).toContain('If an account exists');
    });
  });
});
