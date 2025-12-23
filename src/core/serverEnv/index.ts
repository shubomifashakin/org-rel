import dotenv from 'dotenv';
dotenv.config();

const env = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  S3_BUCKET_NAME: process.env.BUCKET_NAME!,
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY!,
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY!,
  REDIS_URL: process.env.REDIS_URL!,
  SERVICE_NAME: process.env.SERVICE_NAME!,
  AWS_REGION: process.env.AWS_REGION!,
  JWT_SECRET_NAME: process.env.JWT_SECRET_NAME!,
  CLIENT_DOMAIN: process.env.CLIENT_DOMAIN!,
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  MAILER_FROM: process.env.MAILER_FROM!,
  ENVIRONMENT: process.env.NODE_ENV!,
};

export default env;
