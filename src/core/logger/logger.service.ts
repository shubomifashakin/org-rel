import { Injectable } from '@nestjs/common';

//FIXME: USE WINSTON
@Injectable()
export class LoggerService implements LoggerService {
  log(message: any, ...optionalParams: any[]) {
    console.log(message, optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]) {
    console.log(message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    console.log(message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    console.log(message, optionalParams);
  }

  debug?(message: any, ...optionalParams: any[]) {
    console.log(message, optionalParams);
  }
}
