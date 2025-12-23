import { Injectable } from '@nestjs/common';

import { Resend } from 'resend';

import { AppConfigService } from '../app-config/app-config.service.js';

@Injectable()
export class MailerService extends Resend {
  constructor(configService: AppConfigService) {
    const { status, data, error } = configService.ResendApiKey;

    if (!status) {
      throw new Error(error);
    }

    super(data);
  }
}
