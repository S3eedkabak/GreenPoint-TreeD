FROM node:18-alpine

# Install bash for debugging
RUN apk add --no-cache bash

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8081 19000 19001 19002

# Add verbose logging
CMD ["sh", "-c", "echo 'Starting Expo...' && npx expo start --tunnel --verbose"]
