import { Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { JWTGuard } from './guards/jwt.guard.js';
import { AuthService } from './auth.service.js';
import { Roles } from './common/decorators/roles.decorators.js';

@Controller('auth')
@UseGuards(JWTGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Patch('logout')
  logOut() {
    return this.authService.logOut();
  }

  @Post('sign-in')
  @Roles(['user'])
  signIn() {
    return this.authService.signIn();
  }
}
