FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./

# Ignore postinstall because it references server scripts outside this image context.
RUN npm ci --ignore-scripts

COPY . .

ARG VITE_SERVER_URL=https://api.snakestudy.duckdns.org
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

ARG VITE_GOOGLE_CLIENT_ID=385616225550-1o4c17pl52v51sohguahuca2vrmjuhme.apps.googleusercontent.com

ARG VITE_FACEBOOK_APP_ID=941293078316593
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_FACEBOOK_APP_ID=${VITE_FACEBOOK_APP_ID}
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
