FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy your project files
COPY public ./public
COPY db     ./db
# Copy your main entry point — adjust if yours is named differently
COPY server.js ./

# Add a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
