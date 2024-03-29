FROM node:20-bookworm-slim as base

WORKDIR /app
COPY . .
RUN npm i
RUN npm run build

FROM node:20-bookworm-slim as runner
WORKDIR /app
COPY --from=base ./app/dist ./dist
COPY package*.json ./
ENV NODE_ENV production
RUN npm i

EXPOSE 3000

CMD [ "node", "./dist/index.js" ]