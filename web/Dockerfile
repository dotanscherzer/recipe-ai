# Stage 1: Development
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev", "--", "--host"]

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production (serve with nginx)
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
# Ensures /vite.svg exists even if crawlers/analytics request it (Vite also copies public/ into dist).
COPY --from=build /app/public/vite.svg /usr/share/nginx/html/vite.svg
COPY nginx.conf /etc/nginx/conf.d/default.conf
