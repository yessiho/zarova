import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { generateSecret, verifyTOTP, buildKeyURI } from './totp.util.js';

@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // GENERATE SETUP
  //
  // Creates a TOTP secret, 8 one-time backup codes, and a QR
  // code PNG (base64 data URL). Persists the secret and hashed
  // codes but does NOT enable 2FA until verifyAndEnable is called.
  // ============================================================

  async generateSetup(userId: number): Promise<{
    secret: string;
    otpauthUrl: string;
    qrCode: string;
    backupCodes: string[];
  }> {
    const user = await this.prisma.client.orm.public.User.first({ id: userId });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // ==========================================================
    // GENERATE TOTP SECRET (RFC 6238, 20-byte random seed)
    // ==========================================================

    const secret = generateSecret();

    // ==========================================================
    // GENERATE BACKUP CODES
    //
    // 8 one-time codes in 'XXXX-XXXX' hex format.
    // Raw codes are returned once and never stored in plaintext.
    // ==========================================================

    const rawBackupCodes = Array.from({ length: 8 }, () => {
      const part1 = randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
      const part2 = randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
      return `${part1}-${part2}`;
    });

    const hashedBackupCodes = await Promise.all(
      rawBackupCodes.map((code) => bcrypt.hash(code, 12)),
    );

    // ==========================================================
    // BUILD OTPAUTH URI AND QR CODE
    // ==========================================================

    const otpauthUrl = buildKeyURI(user.email, 'Zarova', secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // ==========================================================
    // PERSIST SECRET (NOT YET ENABLED)
    // ==========================================================

    await this.prisma.client.orm.public.User.where({ id: userId }).update({
      twoFactorSecret: secret,
      twoFactorBackupCodes: JSON.stringify(hashedBackupCodes),
    });

    return { secret, otpauthUrl, qrCode, backupCodes: rawBackupCodes };
  }

  // ============================================================
  // VERIFY AND ENABLE
  //
  // Validates the TOTP token against the stored secret and, on
  // success, marks 2FA as enabled on the user record.
  // ============================================================

  async verifyAndEnable(
    userId: number,
    token: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.client.orm.public.User.first({ id: userId });

    if (!user) throw new BadRequestException('User not found');

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        '2FA setup has not been initiated. Call POST /auth/2fa/setup first.',
      );
    }

    const isValid = verifyTOTP(token, user.twoFactorSecret);

    if (!isValid) {
      return { success: false, message: 'Invalid TOTP token. Please try again.' };
    }

    await this.prisma.client.orm.public.User.where({ id: userId }).update({
      twoFactorEnabled: true,
    });

    return { success: true, message: '2FA has been enabled successfully.' };
  }

  // ============================================================
  // DISABLE
  //
  // Requires a live TOTP token before clearing all 2FA state.
  // ============================================================

  async disable(userId: number, token: string): Promise<{ success: boolean }> {
    const user = await this.prisma.client.orm.public.User.first({ id: userId });

    if (!user) throw new BadRequestException('User not found');

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not currently enabled.');
    }

    if (!verifyTOTP(token, user.twoFactorSecret)) {
      throw new UnauthorizedException('Invalid TOTP token. Cannot disable 2FA.');
    }

    await this.prisma.client.orm.public.User.where({ id: userId }).update({
      twoFactorSecret: null,
      twoFactorEnabled: false,
      twoFactorBackupCodes: null,
    });

    return { success: true };
  }

  // ============================================================
  // VALIDATE TOKEN
  //
  // Accepts a live TOTP code or a one-time backup code.
  // Backup codes are consumed on use.
  // ============================================================

  async validateToken(userId: number, token: string): Promise<boolean> {
    const user = await this.prisma.client.orm.public.User.first({ id: userId });

    if (!user || !user.twoFactorSecret) return false;

    // Try live TOTP first
    if (verifyTOTP(token, user.twoFactorSecret)) return true;

    // Fall through to backup codes
    if (!user.twoFactorBackupCodes) return false;

    let hashedCodes: string[];
    try {
      hashedCodes = JSON.parse(user.twoFactorBackupCodes) as string[];
    } catch {
      return false;
    }

    for (let i = 0; i < hashedCodes.length; i++) {
      const matches = await bcrypt.compare(token, hashedCodes[i]);
      if (matches) {
        const remaining = hashedCodes.filter((_, idx) => idx !== i);
        await this.prisma.client.orm.public.User.where({ id: userId }).update({
          twoFactorBackupCodes: JSON.stringify(remaining),
        });
        return true;
      }
    }

    return false;
  }

  // ============================================================
  // GET STATUS
  // ============================================================

  async getStatus(userId: number): Promise<{ enabled: boolean; hasSecret: boolean }> {
    const user = await this.prisma.client.orm.public.User.first({ id: userId });
    if (!user) throw new BadRequestException('User not found');
    return { enabled: user.twoFactorEnabled, hasSecret: !!user.twoFactorSecret };
  }
}
