# Node.js execution container
FROM node:18-alpine

# Create non-root user
RUN adduser -D -s /bin/sh coderunner

# Install security tools
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy execution script
COPY execute.js /app/
RUN chmod +x /app/execute.js

# Create secure temp directory
RUN mkdir -p /tmp/execution && chown coderunner:coderunner /tmp/execution

# Switch to non-root user
USER coderunner

# Set resource limits and security
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "/app/execute.js"]
