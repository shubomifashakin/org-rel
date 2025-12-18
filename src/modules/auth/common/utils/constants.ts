import {
  DAYS_14_MS,
  MINUTES_10_MS,
} from '../../../../common/utils/constants.js';

export const TOKEN = {
  ACCESS: {
    TYPE: 'access_token' as const,
    EXPIRATION: '10m',
    EXPIRATION_MS: MINUTES_10_MS,
  },
  REFRESH: {
    TYPE: 'refresh_token' as const,
    EXPIRATION: '14d',
    EXPIRATION_MS: DAYS_14_MS,
  },
} as const;
