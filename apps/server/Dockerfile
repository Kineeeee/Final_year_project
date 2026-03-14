FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine

ENV NODE_ENV=production
ARG BOT_COUNT=20
ENV BOT_COUNT=${BOT_COUNT}
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
