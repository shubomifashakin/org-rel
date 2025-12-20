import { Injectable } from '@nestjs/common';

import { Resend } from 'resend';
import env from '../serverEnv/index.js';

@Injectable()
export class MailerService extends Resend {
  constructor() {
    super(env.RESEND_API_KEY);
  }
}
