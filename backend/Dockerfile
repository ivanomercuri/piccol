FROM node:20-alpine
RUN apk add curl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000 9229
CMD ["npm", "run", "dev"]
