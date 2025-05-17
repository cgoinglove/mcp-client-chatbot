# Stage 1: Build the Next.js application
FROM node:23-alpine AS builder

WORKDIR /app

# Copy package.json and pnpm-lock.yaml (if you have one) first
# to leverage Docker's layer caching
COPY package.json pnpm-lock.yaml* ./

# Copy the entire scripts directory (still good practice in case other scripts are needed later)
COPY scripts ./scripts

# Install pnpm
RUN npm install -g pnpm


RUN sed -i '/"postinstall": "tsx scripts\/vercelPostinstall.ts",/d' package.json

RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

RUN pnpm initial:flag-generate
RUN pnpm build


FROM node:23-alpine AS runner

WORKDIR /app
RUN npm install -g pnpm
# Copy the build output from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public/


EXPOSE 3000


CMD ["pnpm", "start"]
