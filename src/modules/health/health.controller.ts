import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @SkipThrottle({ default: true })
  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }
}
