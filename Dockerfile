FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.html styles.css favicon.svg manifest.webmanifest sw.js ./
COPY src ./src
COPY icons ./icons
COPY scripts/serve.mjs ./scripts/serve.mjs
COPY server ./server
ENV NODE_ENV=production PORT=4173
EXPOSE 4173
USER node
CMD ["node", "scripts/serve.mjs"]
