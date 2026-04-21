FROM node:22-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/agent-hub/package.json ./apps/agent-hub/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .

USER node
EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@beagle-console/agent-hub", "dev"]
