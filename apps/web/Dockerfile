FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./

# Ignore postinstall because it references server scripts outside this image context.
RUN npm ci --ignore-scripts

COPY . .

ARG VITE_SERVER_URL=https://api.example.com
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
