FROM node:20-alpine
WORKDIR /app
COPY botverse-backend/package*.json ./
RUN npm install --production
COPY botverse-backend/ .
# Let Railway inject PORT, but fallback to 3001
ENV PORT=3001
EXPOSE 3001
CMD ["node", "src/index.js"]
