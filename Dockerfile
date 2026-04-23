FROM node:20-alpine
WORKDIR /app

# Copy package files into botverse-backend directory
COPY botverse-backend/package*.json ./botverse-backend/

# Install dependencies inside that directory
RUN cd botverse-backend && npm install --production

# Copy the rest of the backend files into botverse-backend
COPY botverse-backend/ ./botverse-backend/

ENV PORT=3001
EXPOSE 3001

# Run the server using the path Railway is trying to use
CMD ["node", "botverse-backend/src/index.js"]
