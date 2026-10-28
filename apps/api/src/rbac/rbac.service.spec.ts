import {
  ForbiddenException,
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

import { PrismaService } from '../prisma/prisma.service.js';
import { RbacService } from './rbac.service.js';

// =====================================================
// HELPERS
// =====================================================

const activeAdmin = { id: 1, email: 'admin@test.com', status: 'ACTIVE' };
const suspendedAdmin = { id: 2, email: 'susp@test.com', status: 'SUSPENDED' };

const makeAssignment = (roleId: number) => ({ id: 1, adminId: 1, roleId, isActive: true });
const makeMapping = (permissionId: number) => ({ id: 1, roleId: 10, permissionId, isActive: true });
const makePermission = (code: string) => ({ id: 20, code, isActive: true });

const makePrisma = () => ({
  client: {
    orm: {
      public: {
        Admin: { first: jest.fn() },
        AdminRoleAssignment: { where: jest.fn().mockReturnValue({ all: jest.fn() }) },
        RolePermission: { where: jest.fn().mockReturnValue({ all: jest.fn() }) },
        Permission: { first: jest.fn() },
      },
    },
  },
});

// =====================================================
// TESTS
// =====================================================

describe('RbacService', () => {
  let service: RbacService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(RbacService);
  });

  // ===================================================
  // requireAdmin
  // ===================================================

  describe('requireAdmin', () => {
    it('returns admin when found and active', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(activeAdmin);

      const result = await service.requireAdmin(1);

      expect(result).toEqual(activeAdmin);
      expect(mockPrisma.client.orm.public.Admin.first).toHaveBeenCalledWith({ id: 1 });
    });

    it('throws NotFoundException when admin does not exist', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(null);

      await expect(service.requireAdmin(99)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when admin account is suspended', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(suspendedAdmin);

      await expect(service.requireAdmin(2)).rejects.toThrow(ForbiddenException);
    });
  });

  // ===================================================
  // getAdminPermissions
  // ===================================================

  describe('getAdminPermissions', () => {
    it('returns empty array when admin has no role assignments', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(activeAdmin);
      mockPrisma.client.orm.public.AdminRoleAssignment.where()
        .all.mockResolvedValue([]);

      const result = await service.getAdminPermissions(1);

      expect(result).toEqual([]);
    });

    it('returns permission codes for assigned roles', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(activeAdmin);

      // One role assignment pointing to roleId 10
      mockPrisma.client.orm.public.AdminRoleAssignment.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([makeAssignment(10)]),
      });

      // That role has two permissions
      mockPrisma.client.orm.public.RolePermission.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([
          makeMapping(20),
          makeMapping(21),
        ]),
      });

      mockPrisma.client.orm.public.Permission.first
        .mockResolvedValueOnce(makePermission('DASHBOARD_VIEW'))
        .mockResolvedValueOnce(makePermission('ADMIN_VIEW'));

      const result = await service.getAdminPermissions(1);

      expect(result).toContain('DASHBOARD_VIEW');
      expect(result).toContain('ADMIN_VIEW');
      expect(result).toHaveLength(2);
    });

    it('deduplicates permissions granted by multiple roles', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(activeAdmin);

      // Two role assignments, both granting the same permission
      mockPrisma.client.orm.public.AdminRoleAssignment.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([makeAssignment(10), makeAssignment(11)]),
      });

      mockPrisma.client.orm.public.RolePermission.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([makeMapping(20)]),
      });

      mockPrisma.client.orm.public.Permission.first
        .mockResolvedValue(makePermission('DASHBOARD_VIEW'));

      const result = await service.getAdminPermissions(1);

      expect(result).toEqual(['DASHBOARD_VIEW']);
    });
  });

  // ===================================================
  // hasPermission
  // ===================================================

  describe('hasPermission', () => {
    it('returns true when admin has the permission', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(activeAdmin);
      mockPrisma.client.orm.public.AdminRoleAssignment.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([makeAssignment(10)]),
      });
      mockPrisma.client.orm.public.RolePermission.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([makeMapping(20)]),
      });
      mockPrisma.client.orm.public.Permission.first.mockResolvedValue(makePermission('ADMIN_VIEW'));

      const result = await service.hasPermission(1, 'ADMIN_VIEW');

      expect(result).toBe(true);
    });

    it('returns false when admin does not have the permission', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(activeAdmin);
      mockPrisma.client.orm.public.AdminRoleAssignment.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([]),
      });

      const result = await service.hasPermission(1, 'ADMIN_VIEW');

      expect(result).toBe(false);
    });
  });

  // ===================================================
  // requirePermission
  // ===================================================

  describe('requirePermission', () => {
    it('resolves when admin has the required permission', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(activeAdmin);
      mockPrisma.client.orm.public.AdminRoleAssignment.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([makeAssignment(10)]),
      });
      mockPrisma.client.orm.public.RolePermission.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([makeMapping(20)]),
      });
      mockPrisma.client.orm.public.Permission.first.mockResolvedValue(makePermission('ADMIN_VIEW'));

      await expect(service.requirePermission(1, 'ADMIN_VIEW')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when admin is missing the permission', async () => {
      mockPrisma.client.orm.public.Admin.first.mockResolvedValue(activeAdmin);
      mockPrisma.client.orm.public.AdminRoleAssignment.where = jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([]),
      });

      await expect(service.requirePermission(1, 'ADMIN_CREATE')).rejects.toThrow(ForbiddenException);
    });
  });
});
