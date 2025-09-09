# Python execution container
FROM python:3.9-alpine

# Create non-root user
RUN adduser -D -s /bin/sh coderunner

# Install security tools and basic packages
RUN apk add --no-cache dumb-init gcc musl-dev

# Set working directory
WORKDIR /app

# Copy execution script
COPY execute.py /app/
RUN chmod +x /app/execute.py

# Create secure temp directory
RUN mkdir -p /tmp/execution && chown coderunner:coderunner /tmp/execution

# Switch to non-root user
USER coderunner

# Set resource limits and security
ENTRYPOINT ["dumb-init", "--"]
CMD ["python", "/app/execute.py"]
