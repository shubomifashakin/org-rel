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
import { UserAgent } from '../../common/decorators/user-agent.decorator.js';
import { TOKEN } from './common/utils/constants.js';
import { SignInDto } from './common/dtos/sign-in.dto.js';

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

    response.cookie(TOKEN.REFRESH.TYPE, res.tokens.refreshToken, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: TOKEN.REFRESH.EXPIRATION_MS,
    });

    response.cookie(TOKEN.ACCESS.TYPE, res.tokens.accessToken, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: TOKEN.ACCESS.EXPIRATION_MS,
    });

    return response.status(200).json({ message: 'success' });
  }

  @UseGuards(UserAuthGuard)
  @Post('logout')
  logOut(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const userId = req.user.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const refreshToken = req.cookies?.[TOKEN.REFRESH.TYPE] as
      | string
      | undefined;

    response.clearCookie(TOKEN.REFRESH.TYPE);
    response.clearCookie(TOKEN.ACCESS.TYPE);

    return this.authService.logOut(userId, refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 15 } })
  @Post('sign-in')
  async signIn(
    @Body() body: SignInDto,
    @Res() response: Response,
    @Ip() ipAddr: string,
    @UserAgent() userAgent?: string,
  ) {
    const res = await this.authService.signIn(body, ipAddr, userAgent);

    response.cookie(TOKEN.REFRESH.TYPE, res.tokens.refreshToken, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: TOKEN.REFRESH.EXPIRATION_MS,
    });

    response.cookie(TOKEN.ACCESS.TYPE, res.tokens.accessToken, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: TOKEN.ACCESS.EXPIRATION_MS,
    });

    return response.status(200).json({ message: 'success' });
  }
}
