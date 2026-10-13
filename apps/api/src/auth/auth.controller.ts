import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service.js';

import { CreateAdminDto } from './dto/create-admin.dto.js';
import { LoginDto } from './dto/login.dto.js';

import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { UsersService } from '../users/users.service.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  // ============================================================
  // USER REGISTER
  // ============================================================

  @Post('user/register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  userRegister(
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.usersService.create(createUserDto);
  }

  // ============================================================
  // USER LOGIN
  // ============================================================

  @Post('user/login')
  @ApiOperation({ summary: 'Log in as a user and obtain a JWT token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful, returns access token' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  userLogin(
    @Body() loginDto: LoginDto,
  ) {
    return this.authService.userLogin(loginDto);
  }

  // ============================================================
  // USER FORGOT PASSWORD
  // ============================================================

  @Post('user/forgot-password')
  @ApiOperation({ summary: 'Request a password reset link via email' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
  @ApiResponse({ status: 404, description: 'No account found with this email' })
  forgotPassword(
    @Body('email') email: string,
  ) {
    return this.authService.forgotPassword(email);
  }

  // ============================================================
  // USER RESET PASSWORD
  // ============================================================

  @Post('user/reset-password')
  @ApiOperation({ summary: 'Reset user password using a reset token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'newPassword', 'confirmPassword'],
      properties: {
        token: { type: 'string', description: 'Password reset token from email' },
        newPassword: { type: 'string', format: 'password', description: 'New password' },
        confirmPassword: { type: 'string', format: 'password', description: 'Confirm new password' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token, or passwords do not match' })
  resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
    @Body('confirmPassword') confirmPassword: string,
  ) {
    return this.authService.resetPassword(
      token,
      newPassword,
      confirmPassword,
    );
  }

  // ============================================================
  // ADMIN REGISTER
  // ============================================================

  @Post('admin/register')
  @ApiOperation({ summary: 'Register a new admin account' })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({ status: 201, description: 'Admin registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  adminRegister(
    @Body() createAdminDto: CreateAdminDto,
  ) {
    return this.authService.adminRegister(createAdminDto);
  }

  // ============================================================
  // ADMIN LOGIN
  // ============================================================

  @Post('admin/login')
  @ApiOperation({ summary: 'Log in as an admin and obtain a JWT token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Admin login successful, returns access token' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account does not have admin privileges' })
  adminLogin(
    @Body() loginDto: LoginDto,
  ) {
    return this.authService.adminLogin(loginDto);
  }
}
