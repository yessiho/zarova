import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  ArrayNotEmpty,
} from 'class-validator';

import {
  WEBHOOK_EVENT_LIST,
  type WebhookEvent,
} from '../webhook-events.constants.js';

export class CreateWebhookDto {
  /*
   * The URL to deliver webhook payloads to.
   */
  @IsUrl({}, { message: 'url must be a valid URL' })
  url!: string;

  /*
   * List of event types this webhook subscribes to.
   * Each element must be a recognised WEBHOOK_EVENT name.
   */
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENT_LIST, { each: true })
  events!: WebhookEvent[];

  /*
   * Optional human-readable description of the webhook.
   */
  @IsOptional()
  @IsString()
  description?: string;
}
