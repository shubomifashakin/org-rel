import dotenv from 'dotenv';
dotenv.config();

const env = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  S3_BUCKET_NAME: process.env.BUCKET_NAME!,
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY!,
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY!,
  REDIS_URL: process.env.REDIS_URL!,
  AWS_REGION: process.env.AWS_REGION!,
};

export default env;
