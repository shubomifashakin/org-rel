FROM node:24.12-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./

COPY prisma/ ./prisma
COPY prisma.config.ts ./
COPY src/  ./src

RUN npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]