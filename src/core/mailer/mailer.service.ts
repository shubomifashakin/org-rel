import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Resend } from 'resend';

@Injectable()
export class MailerService extends Resend {
  constructor(configService: ConfigService) {
    const resendApiKey = configService.getOrThrow<string>('RESEND_API_KEY');

    super(resendApiKey);
  }
}
