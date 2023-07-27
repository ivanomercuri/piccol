FROM node:latest

WORKDIR /nuxt

RUN npx nuxi@latest init .

RUN npm install

RUN npm install --save-exact @nuxtjs/auth-next

CMD ["npm","run","dev"]