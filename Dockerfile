FROM node:22-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
ARG REPO_REF=master
RUN git clone --depth 1 --branch "$REPO_REF" https://github.com/wlmirand/yamtrack-mcp.git .
RUN npm ci --ignore-scripts && npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 8080

CMD ["node", "dist/index.js", "--transport", "http", "--port", "8080"]
