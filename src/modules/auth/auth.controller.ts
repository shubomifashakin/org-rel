import { Throttle } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { SignUpDto } from './common/dtos/sign-up.dto.js';
import { SignInDto } from './common/dtos/sign-in.dto.js';

import { TOKEN } from '../../common/utils/constants.js';
import { UserAgent } from '../../common/decorators/user-agent.decorator.js';
import { UserAuthGuard } from '../../common/guards/user-auth.guard.js';
import { GetImage } from '../../common/decorators/get-image.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 15 } })
  @Post('sign-up')
  @GetImage()
  async signUp(
    @Body() signUpDto: SignUpDto,
    @Res() response: Response,
    @Ip() ipAddr: string,
    @UploadedFile() file?: Express.Multer.File,
    @UserAgent() userAgent?: string,
  ) {
    const res = await this.authService.signUp(
      signUpDto,
      ipAddr,
      file,
      userAgent,
    );

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
  @Post('sign-out')
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const userId = req.user.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const refreshToken = req.cookies?.[TOKEN.REFRESH.TYPE] as string;
    const accessToken = req.cookies?.[TOKEN.ACCESS.TYPE] as string;

    await this.authService.signOut(userId, refreshToken, accessToken);

    response.clearCookie(TOKEN.REFRESH.TYPE);
    response.clearCookie(TOKEN.ACCESS.TYPE);

    return { message: 'success' };
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

  @Throttle({ default: { limit: 5, ttl: 15 } })
  @Get('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
    @Ip() ipAddr: string,
    @UserAgent() userAgent?: string,
  ) {
    const refreshToken = req.cookies?.[TOKEN.REFRESH.TYPE] as
      | string
      | undefined;

    const res = await this.authService.refresh(ipAddr, refreshToken, userAgent);

    response.cookie(TOKEN.REFRESH.TYPE, res.refreshToken, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: TOKEN.REFRESH.EXPIRATION_MS,
    });

    response.cookie(TOKEN.ACCESS.TYPE, res.accessToken, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: TOKEN.ACCESS.EXPIRATION_MS,
    });

    return { message: 'success' };
  }
}
