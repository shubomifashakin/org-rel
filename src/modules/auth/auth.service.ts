import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import { SignUpDto } from './common/dtos/sign-up.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async signUp(signUpDto: SignUpDto) {
    //FIXME: HASH THE PASSWORD
    await this.databaseService.users.create({
      data: {
        email: signUpDto.email,
        fullname: signUpDto.fullname,
        username: signUpDto.username,
        password: signUpDto.password,
      },
    });
  }

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
