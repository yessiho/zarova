import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Query,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UploadService } from './upload.service.js';

type KycFolder = 'kyc-front' | 'kyc-back' | 'kyc-selfie';

const ALLOWED_FOLDERS: KycFolder[] = ['kyc-front', 'kyc-back', 'kyc-selfie'];

@ApiTags('Upload')
@ApiBearerAuth('access-token')
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /upload/kyc
   *
   * Upload a KYC document image and return its public URL.
   * Accepts: kyc-front | kyc-back | kyc-selfie
   */
  @Post('kyc')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Upload a KYC document image',
    description:
      'Uploads an image to Cloudinary and returns the secure URL. Pass ?type=kyc-front | kyc-back | kyc-selfie.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'type', enum: ALLOWED_FOLDERS })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Returns { url: string }' })
  @ApiResponse({ status: 400, description: 'Invalid file or type' })
  async uploadKycFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,

    @Query('type')
    type: string,
  ) {
    if (!ALLOWED_FOLDERS.includes(type as KycFolder)) {
      throw new BadRequestException(
        `type must be one of: ${ALLOWED_FOLDERS.join(', ')}`,
      );
    }

    const url = await this.uploadService.uploadKycDocument(file, type as KycFolder);
    return { url };
  }
}
