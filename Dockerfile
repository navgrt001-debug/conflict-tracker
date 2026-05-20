FROM node:20-alpine

WORKDIR /app

# --- Server dependencies ---
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# --- Client dependencies + build ---
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# --- Copy server source ---
COPY server/ ./server/

# --- Copy static data files ---
COPY server/data/ ./server/data/

EXPOSE 3001

CMD ["node", "server/index.js"]
