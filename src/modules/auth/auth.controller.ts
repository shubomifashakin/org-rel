import { Throttle } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import {
  Body,
  Controller,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { UserAuthGuard } from './guards/user-auth.guard.js';
import { AuthService } from './auth.service.js';
import { SignUpDto } from './common/dtos/sign-up.dto.js';
import { DAYS_14_MS, MINUTES_10_MS } from '../../common/utils/constants.js';
import { UserAgent } from '../../common/decorators/user-agent.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 15 } })
  @Post('sign-up')
  async signUp(
    @Body() signUpDto: SignUpDto,
    @Res() response: Response,
    @Ip() ipAddr: string,
    @UserAgent() userAgent?: string,
  ) {
    const res = await this.authService.signUp(signUpDto, ipAddr, userAgent);

    response.cookie('refresh_token', res.tokens.refreshToken, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: DAYS_14_MS,
    });

    response.cookie('auth_token', res.tokens.accessToken, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: MINUTES_10_MS,
    });

    return response.status(200).json({ message: 'success' });
  }

  @UseGuards(UserAuthGuard)
  @Post('logout')
  logOut(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const userId = req.user.id;
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

    response.clearCookie('refresh_token');
    response.clearCookie('auth_token');

    return this.authService.logOut(userId, refreshToken);
  }

  @Post('sign-in')
  signIn() {
    return this.authService.signIn();
  }
}
