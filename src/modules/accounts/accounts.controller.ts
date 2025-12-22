import { type Response, type Request } from 'express';
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Req,
  Res,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';

import { AccountsService } from './accounts.service.js';

import { UpdateAccountDto } from './dtos/update-account.dto.js';

import { UserAuthGuard } from '../../common/guards/user-auth.guard.js';
import { GetImage } from '../../common/decorators/get-image.decorator.js';
import { TOKEN } from '../../common/utils/constants.js';
import { ValidateUUID } from '../organizations/common/decorators/uuid-validator.decorator.js';
import { UpdateInviteDto } from './dtos/update-invite.dto.js';

@Controller('accounts')
@UseGuards(UserAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('me')
  getMyAccountInfo(@Req() req: Request) {
    return this.accountsService.getMyAccountInfo(req.user.id);
  }

  @Delete('me')
  async deleteMyAccount(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.accountsService.deleteMyAccount(req.user.id);
    res.clearCookie(TOKEN.ACCESS.TYPE);
    res.clearCookie(TOKEN.REFRESH.TYPE);

    return { message: 'success' };
  }

  @Patch('me')
  @GetImage()
  updateMyAccount(
    @Req() req: Request,
    @Body() updateAccountDto: UpdateAccountDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.accountsService.updateMyAccount(
      req.user.id,
      updateAccountDto,
      file,
    );
  }

  @Get('me/invites')
  getAllInvites(@Req() req: Request) {
    const email = req.user.email;
    return this.accountsService.getAllInvites(email);
  }

  @Patch('me/invites/:inviteId')
  updateInviteStatus(
    @ValidateUUID('inviteId', 'Invalid invite id') inviteId: string,
    @Body() updateInviteDto: UpdateInviteDto,
    @Req() req: Request,
  ) {
    const email = req.user.email;
    return this.accountsService.updateInviteStatus(
      inviteId,
      updateInviteDto,
      email,
      req.user.id,
    );
  }
}
