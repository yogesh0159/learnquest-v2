# LearnQuest server for Railway (also runs anywhere Docker runs)
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY backend/package.json ./backend/package.json
RUN npm --prefix backend install --omit=dev --omit=optional --no-audit --no-fund
COPY backend ./backend
COPY frontend ./frontend
EXPOSE 4000
CMD ["node", "backend/server.js"]
