FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package.json ./server/package.json
RUN cd server && npm install

# Install client dependencies
COPY client/package.json ./client/package.json
RUN cd client && npm install

# Build-time env vars for Vite (passed via Railway build variables)
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build Vite frontend (VITE_ vars are embedded into the bundle here)
COPY client/ ./client/
RUN cd client && npm run build

# Copy server source
COPY server/ ./server/

EXPOSE 3001

CMD ["node", "server/index.js"]
