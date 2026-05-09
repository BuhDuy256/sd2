FROM node:18-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# Copy application source
COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/index.js"]
