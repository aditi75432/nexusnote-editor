# Step 1: Build React App
FROM node:18-alpine as build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ .
RUN npm run build

# Step 2: Setup Server
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install
COPY server/ .

# Step 3: Copy React build to Server static folder
COPY --from=build /app/client/build ./public

# Expose Port
EXPOSE 5000
CMD ["node", "server.js"]