# ----------- CONTRACT BUILD STAGE -----------
FROM rust:slim-bookworm AS contract-builder

WORKDIR /contract

RUN rustup target add wasm32v1-none

COPY contracts/vesta-payout-vault ./vesta-payout-vault

RUN cargo build \
    --manifest-path vesta-payout-vault/Cargo.toml \
    --target wasm32v1-none \
    --release

# ----------- BUILD STAGE -----------
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y \
    wget ca-certificates openssl \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

RUN wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    -O /etc/ssl/certs/global-bundle.pem

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN npx prisma generate --config src/infra/database/@prisma/prisma.config.ts
RUN yarn build

# ----------- RUNTIME STAGE -----------
FROM node:22-slim

WORKDIR /app

# só o necessário em runtime
RUN apt-get update -y && apt-get install -y \
    ca-certificates wget \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /etc/ssl/certs/global-bundle.pem /etc/ssl/certs/

COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/zk-artifacts ./zk-artifacts
COPY --from=contract-builder \
  /contract/vesta-payout-vault/target/wasm32v1-none/release/vesta_payout_vault.wasm \
  ./contract-artifacts/vesta_payout_vault.wasm

RUN yarn install --production --frozen-lockfile && yarn cache clean

RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/src/main"]
