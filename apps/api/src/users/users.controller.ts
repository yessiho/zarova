import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

import { UsersService } from './users.service.js';

interface AuthenticatedUser {
  id: number;
  email: string;
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  /*
   * ==========================================
   * CREATE USER
   *
   * POST /users
   * ==========================================
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new user',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  create(
    @Body()
    createUserDto: CreateUserDto,
  ) {
    return this.usersService.create(createUserDto);
  }

  /*
   * ==========================================
   * GET ALL USERS
   *
   * GET /users
   * ==========================================
   */
  @Get()
  @ApiOperation({
    summary: 'Get all users',
  })
  @ApiResponse({ status: 200, description: 'List of all users returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.usersService.findAll();
  }

  /*
   * ==========================================
   * GET AUTHENTICATED USER PROFILE
   *
   * GET /users/profile
   * ==========================================
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get authenticated user profile',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  getProfile(
    @Req()
    request: Request,
  ) {
    const user =
      request.user as AuthenticatedUser;

    return this.usersService.getProfile(user.id);
  }

  /*
   * ==========================================
   * UPDATE AUTHENTICATED USER PROFILE
   *
   * PATCH /users/profile
   * ==========================================
   */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update authenticated user profile',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateProfile(
    @Req()
    request: Request,

    @Body()
    updateProfileDto: UpdateProfileDto,
  ) {
    const user =
      request.user as AuthenticatedUser;

    return this.usersService.updateProfile(
      user.id,
      updateProfileDto,
    );
  }

  /*
   * ==========================================
   * CHANGE AUTHENTICATED USER PASSWORD
   *
   * PATCH /users/change-password
   * ==========================================
   */
  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change authenticated user password',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or incorrect current password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  changePassword(
    @Req()
    request: Request,

    @Body()
    changePasswordDto: ChangePasswordDto,
  ) {
    const user =
      request.user as AuthenticatedUser;

    return this.usersService.changePassword(
      user.id,
      changePasswordDto,
    );
  }

  /*
   * ==========================================
   * GET USER BY ID
   *
   * GET /users/:id
   * ==========================================
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
  })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User found and returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid ID format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.usersService.findOne(id);
  }
}