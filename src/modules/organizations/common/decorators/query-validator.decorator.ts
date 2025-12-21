import { BadRequestException, ParseUUIDPipe, Query } from '@nestjs/common';

export function ValidateUUIDQueryParam(
  id: string,
  message: string | null,
  optional?: boolean,
) {
  return Query(
    id,
    new ParseUUIDPipe({
      exceptionFactory() {
        return new BadRequestException(message || `Invalid ${id} query param`);
      },
      optional,
    }),
  );
}
