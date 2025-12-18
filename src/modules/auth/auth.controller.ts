import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserAuthGuard } from './guards/user-auth.guard.js';
import { AuthService } from './auth.service.js';
import { SignUpDto } from './common/dtos/sign-up.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
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
