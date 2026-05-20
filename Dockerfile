FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package.json ./server/package.json
RUN cd server && npm install

# Install client dependencies
COPY client/package.json ./client/package.json
RUN cd client && npm install

# Build Vite frontend
COPY client/ ./client/
RUN cd client && npm run build

# Copy server source (includes data/ static files)
COPY server/ ./server/

EXPOSE 3001

CMD ["node", "server/index.js"]
