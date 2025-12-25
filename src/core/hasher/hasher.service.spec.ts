import { Test, TestingModule } from '@nestjs/testing';
import { HasherService } from './hasher.service.js';

describe('HasherService', () => {
  let service: HasherService;
  let hashedString: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HasherService],
    }).compile();

    service = module.get<HasherService>(HasherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('hashString - it should hash a string', async () => {
    const result = await service.hashString('test');
    expect(result.status).toBe(true);
    expect(result.error).toBe(null);
    expect(result.data).toStrictEqual(expect.any(String));
    hashedString = result.data!;
  });

  it('compareHashString - it should be valid', async () => {
    const result = await service.compareHashedString({
      plainString: 'test',
      hash: hashedString,
    });
    expect(result.status).toBe(true);
    expect(result.error).toBe(null);
    expect(result.data).toBe(true);
  });

  it('compareHashString - it should not be valid', async () => {
    const result = await service.compareHashedString({
      plainString: 'testss',
      hash: hashedString,
    });
    expect(result.status).toBe(true);
    expect(result.error).toBe(null);
    expect(result.data).toBe(false);
  });
});
