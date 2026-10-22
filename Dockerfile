# Dois alvos: `web` (front-end estático em nginx) e `realtime` (servidor de salas em Node).
#   docker build --target web -t omega-web .
#   docker build --target realtime -t omega-realtime .

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

FROM node:24-alpine AS realtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
# O servidor reutiliza o motor de regras do jogo (src/core).
COPY server ./server
COPY src/core ./src/core
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8787/health || exit 1
CMD ["node", "server/server.mjs"]
