import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

import { randomBytes, createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';

import { CreateAdminDto } from './dto/create-admin.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { nowInstant, toInstant } from '../prisma/temporal.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  // ============================================================
  // USER LOGIN
  // ============================================================

  async userLogin(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.client.orm.public.User.first({
      email: normalizedEmail,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      type: 'USER',
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,

      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
    };
  }

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.client.orm.public.User.first({
      email: normalizedEmail,
    });

    /*
     * Security:
     *
     * Never reveal whether an email address exists.
     */
    const successMessage =
      'If an account exists with this email address, a password reset link has been generated.';

    if (!user) {
      return {
        message: successMessage,
      };
    }

    // ==========================================================
    // GENERATE SECURE TOKEN
    // ==========================================================

    const resetToken = randomBytes(32).toString('hex');

    /*
     * Hash token before storing it.
     *
     * The raw token should never be stored in the database.
     */
    const hashedResetToken = createHash('sha256')
      .update(resetToken)
      .digest('hex');

    /*
     * Token expires in 15 minutes.
     *
     * Your Prisma contract uses TimestamptzString,
     * so ISO string format is appropriate.
     */
    const passwordResetExpires = new Date(
      Date.now() + 15 * 60 * 1000,
    ).toISOString();

    // ==========================================================
    // UPDATE USER
    //
    // IMPORTANT:
    // Prisma 8 contract API requires:
    //
    // User.where(...).update(...)
    //
    // NOT:
    //
    // User.update({ where, data })
    // ==========================================================

    await this.prisma.client.orm.public.User.where({
      id: user.id,
    }).update({
      passwordResetToken: hashedResetToken,
      passwordResetExpires,
    });

    // ──────────────────────────────────────────────────────────────
    // Send password reset email.
    // EmailService silently skips in dev mode when EMAIL_USER is
    // not configured, so this is always safe to call.
    // ──────────────────────────────────────────────────────────────
    const frontendUrl =
      process.env['FRONTEND_URL'] ?? 'http://localhost:3000';

    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.firstName,
      resetToken,
      resetUrl,
    );

    const devMode = !process.env['EMAIL_USER'];

    return {
      message: successMessage,
      // Only expose the raw token when email is not configured.
      // Remove this field once a real SMTP provider is wired up.
      ...(devMode ? { resetToken, expiresIn: '15 minutes' } : {}),
    };
  }

  // ============================================================
  // RESET PASSWORD
  // ============================================================

  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!token) {
      throw new BadRequestException(
        'Password reset token is required',
      );
    }

    if (!newPassword || !confirmPassword) {
      throw new BadRequestException(
        'New password and confirmation password are required',
      );
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'Passwords do not match',
      );
    }

    if (newPassword.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    // ==========================================================
    // HASH INCOMING TOKEN
    // ==========================================================

    const hashedToken = createHash('sha256')
      .update(token)
      .digest('hex');

    // ==========================================================
    // FIND USER WITH TOKEN
    // ==========================================================

    const user = await this.prisma.client.orm.public.User.first({
      passwordResetToken: hashedToken,
    });

    if (!user) {
      throw new BadRequestException(
        'Invalid or expired password reset token',
      );
    }

    // ==========================================================
    // CHECK TOKEN EXPIRATION
    // ==========================================================

    if (!user.passwordResetExpires) {
      throw new BadRequestException(
        'Invalid or expired password reset token',
      );
    }

    const expirationDate = new Date(
      user.passwordResetExpires,
    );

    if (Number.isNaN(expirationDate.getTime())) {
      throw new BadRequestException(
        'Invalid password reset expiration date',
      );
    }

    if (expirationDate.getTime() < Date.now()) {
      /*
       * Optional cleanup of expired token.
       */
      await this.prisma.client.orm.public.User.where({
        id: user.id,
      }).update({
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      throw new BadRequestException(
        'Password reset token has expired',
      );
    }

    // ==========================================================
    // HASH NEW PASSWORD
    // ==========================================================

    const passwordHash = await bcrypt.hash(
      newPassword,
      12,
    );

    // ==========================================================
    // UPDATE PASSWORD
    //
    // Also invalidate the reset token immediately.
    // ==========================================================

    await this.prisma.client.orm.public.User.where({
      id: user.id,
    }).update({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    return {
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }

  // ============================================================
  // ADMIN REGISTER
  // ============================================================

  async adminRegister(createAdminDto: CreateAdminDto) {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
      } = createAdminDto;

      const normalizedEmail = email.trim().toLowerCase();

      const existingAdmin =
        await this.prisma.client.orm.public.Admin.first({
          email: normalizedEmail,
        });

      if (existingAdmin) {
        throw new ConflictException(
          'Admin email already exists',
        );
      }

      const passwordHash = await bcrypt.hash(
        password,
        12,
      );

      const admin =
        await this.prisma.client.orm.public.Admin.create({
          email: normalizedEmail,
          passwordHash,
          firstName,
          lastName,
          updatedAt: nowInstant(),
        });

      return {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        status: admin.status,
        createdAt: admin.createdAt,
      };
    } catch (error) {
      console.error('[adminRegister] ERROR:', error);
      throw error;
    }
  }

  // ============================================================
  // ADMIN LOGIN
  // ============================================================

  async adminLogin(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const normalizedEmail = email.trim().toLowerCase();

    const admin =
      await this.prisma.client.orm.public.Admin.first({
        email: normalizedEmail,
      });

    if (!admin) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    if (admin.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Admin account is not active',
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      admin.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      type: 'ADMIN',
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,

      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        status: admin.status,
      },
    };
  }
}