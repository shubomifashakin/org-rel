import { BadRequestException, Param, ParseUUIDPipe } from '@nestjs/common';

export const ValidateUUID = (property = 'id', message: string) => {
  return Param(
    property,
    new ParseUUIDPipe({
      exceptionFactory: () => new BadRequestException(message),
    }),
  );
};
