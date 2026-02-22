FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production

RUN addgroup -S claw && adduser -S claw -G claw
USER claw

CMD ["node", "dist/cli/openclaw.js"]
