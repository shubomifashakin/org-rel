import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return { time: new Date().toISOString(), status: 'ok' };
  }
}
