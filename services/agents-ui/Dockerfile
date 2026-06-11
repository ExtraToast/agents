FROM node:26-alpine AS build
# Node 25's alpine image dropped corepack from the base layer but still
# ships /usr/local/bin/yarn, which makes `npm install -g corepack` fail
# with EEXIST. Install pnpm directly at the packageManager version in
# package.json instead of going through corepack's shim dance.
RUN npm install -g pnpm@9.15.4
WORKDIR /app
ARG NODE_AUTH_TOKEN=
COPY .npmrc pnpm-workspace.yaml package.json ./
COPY services/agents-ui/package.json services/agents-ui/
RUN --mount=type=secret,id=github_token \
    NODE_AUTH_TOKEN="${NODE_AUTH_TOKEN:-$(cat /run/secrets/github_token 2>/dev/null || true)}" \
    pnpm config set //npm.pkg.github.com/:_authToken "${NODE_AUTH_TOKEN}" \
    && pnpm config set @extratoast:registry https://npm.pkg.github.com \
    && pnpm install --no-frozen-lockfile
COPY services/agents-ui/ services/agents-ui/
ARG VITE_AUTH_URL=https://auth.jorisjonkers.dev
ARG VITE_FARO_URL=https://faro.jorisjonkers.dev/collect
ARG VITE_GITHUB_APP_SLUG=extratoast-agents
RUN VITE_AUTH_URL=${VITE_AUTH_URL} \
    VITE_FARO_URL=${VITE_FARO_URL} \
    VITE_GITHUB_APP_SLUG=${VITE_GITHUB_APP_SLUG} \
    pnpm --filter @extratoast/agents-ui build

FROM nginx:alpine
COPY services/agents-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/services/agents-ui/dist /usr/share/nginx/html
EXPOSE 80
