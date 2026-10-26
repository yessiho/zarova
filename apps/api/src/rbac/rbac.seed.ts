import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { nowInstant } from '../prisma/temporal.js';

import {
  ADMIN_ROLE_CODES,
  PERMISSION_CODES,
  ROLE_PERMISSIONS,
} from './rbac.constants.js';

@Injectable()
export class RbacSeedService implements OnModuleInit {
  private readonly logger =
    new Logger(RbacSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.seed();
    await this.bootstrapFirstAdmin();
  }

  /**
   * If the first-registered admin has no roles, assign them SUPER_ADMIN.
   * This handles cold-start bootstrap where the admin was created before
   * the RBAC tables were populated.
   */
  private async bootstrapFirstAdmin(): Promise<void> {
    const firstAdmin =
      await this.prisma.client.orm.public.Admin.first({
        id: 1,
      });

    if (!firstAdmin) {
      return;
    }

    const existingAssignments =
      await this.prisma.client.orm.public.AdminRoleAssignment.where({
        adminId: firstAdmin.id,
      }).all();

    if (existingAssignments.length > 0) {
      return;
    }

    const superAdminRole =
      await this.prisma.client.orm.public.AdminRole.first({
        code: ADMIN_ROLE_CODES.SUPER_ADMIN,
      });

    if (!superAdminRole) {
      this.logger.error(
        'SUPER_ADMIN role not found after seeding — cannot bootstrap first admin.',
      );
      return;
    }

    await this.prisma.client.orm.public.AdminRoleAssignment.create({
      adminId: firstAdmin.id,
      roleId: superAdminRole.id,
      isActive: true,
      updatedAt: nowInstant(),
    });

    this.logger.log(
      `Assigned SUPER_ADMIN role to first admin: ${firstAdmin.email}`,
    );
  }

  /**
   * Seed the complete RBAC definition.
   *
   * This operation is intentionally idempotent:
   *
   * - Existing records are preserved.
   * - Missing records are created.
   * - Inactive permissions are reactivated.
   * - Inactive roles are reactivated.
   * - Inactive role-permission mappings are reactivated.
   * - Existing unrelated permissions are not removed.
   *
   * This method does NOT assign roles to administrators.
   */
  async seed(): Promise<void> {
    this.logger.log('Starting RBAC seed...');

    await this.seedPermissions();
    await this.seedRoles();
    await this.seedRolePermissions();

    this.logger.log(
      'RBAC seed completed successfully.',
    );
  }

  /**
   * Convert an internal code such as:
   *
   * TRANSACTION_VIEW
   *
   * into:
   *
   * Transaction View
   */
  private humanize(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map(
        (part) =>
          part.charAt(0).toUpperCase() +
          part.slice(1),
      )
      .join(' ');
  }

  /**
   * Seed permissions.
   */
  private async seedPermissions(): Promise<void> {
    this.logger.log('Seeding permissions...');

    for (const code of Object.values(PERMISSION_CODES)) {
      const existing =
        await this.prisma.client.orm.public.Permission.first({
          code,
        });

      if (!existing) {
        await this.prisma.client.orm.public.Permission.create({
          code,
          name: this.humanize(code),
          description: `Permission to ${this.humanize(
            code,
          ).toLowerCase()}`,
          isActive: true,
          updatedAt: nowInstant(),
        });

        this.logger.log(
          `Created permission: ${code}`,
        );

        continue;
      }

      if (!existing.isActive) {
        await this.prisma.client.orm.public.Permission
          .where({
            id: existing.id,
          })
          .update({
            isActive: true,
            updatedAt: nowInstant(),
          });

        this.logger.log(
          `Reactivated permission: ${code}`,
        );
      }
    }

    this.logger.log(
      'Permissions seeded.',
    );
  }

  /**
   * Seed administrator roles.
   */
  private async seedRoles(): Promise<void> {
    this.logger.log(
      'Seeding admin roles...',
    );

    for (const code of Object.values(ADMIN_ROLE_CODES)) {
      const existing =
        await this.prisma.client.orm.public.AdminRole.first({
          code,
        });

      if (!existing) {
        await this.prisma.client.orm.public.AdminRole.create({
          code,
          name: this.humanize(code),
          description: `${this.humanize(
            code,
          )} administrative role`,
          isActive: true,
          updatedAt: nowInstant(),
        });

        this.logger.log(
          `Created role: ${code}`,
        );

        continue;
      }

      if (!existing.isActive) {
        await this.prisma.client.orm.public.AdminRole
          .where({
            id: existing.id,
          })
          .update({
            isActive: true,
            updatedAt: nowInstant(),
          });

        this.logger.log(
          `Reactivated role: ${code}`,
        );
      }
    }

    this.logger.log(
      'Admin roles seeded.',
    );
  }

  /**
   * Seed role → permission relationships.
   */
  private async seedRolePermissions(): Promise<void> {
    this.logger.log(
      'Seeding role-permission mappings...',
    );

    for (const [
      roleCode,
      permissionCodes,
    ] of Object.entries(ROLE_PERMISSIONS)) {
      const role =
        await this.prisma.client.orm.public.AdminRole.first({
          code: roleCode,
        });

      if (!role) {
        throw new Error(
          `RBAC role not found: ${roleCode}`,
        );
      }

      for (const permissionCode of permissionCodes) {
        const permission =
          await this.prisma.client.orm.public.Permission.first({
            code: permissionCode,
          });

        if (!permission) {
          throw new Error(
            `RBAC permission not found: ${permissionCode}`,
          );
        }

        const existing =
          await this.prisma.client.orm.public.RolePermission.first({
            roleId: role.id,
            permissionId: permission.id,
          });

        if (!existing) {
          await this.prisma.client.orm.public.RolePermission.create({
            roleId: role.id,
            permissionId: permission.id,
            isActive: true,
            updatedAt: nowInstant(),
          });

          this.logger.log(
            `Mapped ${roleCode} → ${permissionCode}`,
          );

          continue;
        }

        if (!existing.isActive) {
          await this.prisma.client.orm.public.RolePermission
            .where({
              id: existing.id,
            })
            .update({
              isActive: true,
              updatedAt: nowInstant(),
            });

          this.logger.log(
            `Reactivated mapping ${roleCode} → ${permissionCode}`,
          );
        }
      }
    }

    this.logger.log(
      'Role-permission mappings seeded.',
    );
  }
}