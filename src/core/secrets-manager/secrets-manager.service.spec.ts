import { Test, TestingModule } from '@nestjs/testing';
import { SecretsManagerService } from './secrets-manager.service';

describe('SecretsManagerService', () => {
  let service: SecretsManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecretsManagerService],
    }).compile();

    service = module.get<SecretsManagerService>(SecretsManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
