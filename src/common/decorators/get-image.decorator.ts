import { BadRequestException, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

export const GetImage = (fieldname = 'file', limit = 5 * 1024 * 1024) => {
  return UseInterceptors(
    FileInterceptor(fieldname, {
      fileFilter: (_, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Only img, png and jpeg files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: limit || undefined,
      },
    }),
  );
};
