import { type Response } from 'express';
import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';

import { UserAuthGuard } from './guards/user-auth.guard.js';
import { AuthService } from './auth.service.js';
import { SignUpDto } from './common/dtos/sign-up.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  async signUp(@Body() signUpDto: SignUpDto, @Res() response: Response) {
    const res = await this.authService.signUp(signUpDto);

    response.cookie('auth_token', res.jwt, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return response.status(200).json({ message: 'success' });
  }

  @UseGuards(UserAuthGuard)
  @Post('logout')
  logOut() {
    return this.authService.logOut();
  }

  @Post('sign-in')
  signIn() {
    return this.authService.signIn();
  }
}
