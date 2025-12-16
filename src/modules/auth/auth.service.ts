import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async logOut() {
    const sessionExists = await this.databaseService.sessions.findUnique({
      where: {
        id: '',
      },
    });

    if (!sessionExists) {
      return { message: 'success' };
    }

    await this.databaseService.sessions.delete({
      where: {
        id: sessionExists.id,
      },
    });

    return { message: 'success' };
  }

  signIn() {
    return { message: 'hello world' };
  }
}
