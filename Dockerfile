# One image = the whole app (API + built React). Needs DATABASE_URL at runtime.
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/index.js"]
