import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    this.configured = !!(cloudName && apiKey && apiSecret);

    if (this.configured) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    } else {
      this.logger.warn('Cloudinary env vars not set — file upload will return placeholder URLs.');
    }
  }

  async uploadKycDocument(
    file: Express.Multer.File,
    folder: 'kyc-front' | 'kyc-back' | 'kyc-selfie',
  ): Promise<string> {
    if (!this.configured) {
      // Return a stable placeholder so KYC submission still works in dev
      return `https://placehold.co/800x500?text=${folder}`;
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `zarova/${folder}`,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed', error);
            reject(error ?? new Error('Upload failed'));
            return;
          }
          this.logger.log(`Uploaded ${folder}: ${result.secure_url}`);
          resolve(result.secure_url);
        },
      );

      stream.end(file.buffer);
    });
  }
}
