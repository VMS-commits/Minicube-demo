FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production
COPY server.js ./
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
