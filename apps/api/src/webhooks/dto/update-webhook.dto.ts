import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateWebhookDto } from './create-webhook.dto.js';

export class UpdateWebhookDto extends PartialType(CreateWebhookDto) {
  /*
   * Enable or disable the webhook without deleting it.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
