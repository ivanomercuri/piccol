FROM node:latest

WORKDIR /nuxt

RUN npx nuxi@latest init .

RUN npm install

CMD ["npm","run","dev"]