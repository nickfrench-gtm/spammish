FROM node:22-alpine
WORKDIR /app
COPY marketing ./marketing
ENV NODE_ENV=production PORT=8080 WAITLIST_DATA_DIR=/data PUBLIC_ORIGIN=https://spammish.fly.dev
EXPOSE 8080
CMD ["node", "marketing/server.mjs"]
