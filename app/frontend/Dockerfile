# --- build: bake REACT_APP_* at compile time (required for production) ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Dokploy / docker-compose must pass: --build-arg REACT_APP_BACKEND_URL=https://api.yourdomain.com
ARG REACT_APP_BACKEND_URL=https://api.hamptonscientific.com
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

RUN yarn build

# --- run: static files only (no dev server) ---
FROM node:20-alpine

RUN npm install -g serve

WORKDIR /app
COPY --from=build /app/build ./build

ENV PORT=3001
EXPOSE 3001

CMD ["serve", "-s", "build", "-l", "3001"]
