# Use Node 20 as specified in your Jenkins environment
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of your app code
COPY . .

# Run the tests defined in your package.json
CMD ["npm", "test"]