import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { DatabaseService } from '../../core/database/database.service.js';
import { SignUpDto } from './common/dtos/sign-up.dto.js';
import { hashPassword } from '../../common/utils/fns.js';

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async signUp(signUpDto: SignUpDto) {
    //FIXME: HASH THE PASSWORD
    const { status, data, error } = await hashPassword(signUpDto.password);

    if (!status) {
      //FIXME: USE A BETTER ERROR LOGGER
      console.error(error);
      throw new InternalServerErrorException('Something went wrong');
    }

    await this.databaseService.users.create({
      data: {
        password: data,
        email: signUpDto.email,
        fullname: signUpDto.fullname,
        username: signUpDto.username,
      },
    });

    //FIXME: GENERATE JWT TO USE AS A SESSION
    //generate jwt to use as a session

    return { message: 'success' };
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
