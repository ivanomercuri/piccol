FROM node:latest

WORKDIR /nuxt

COPY src/nuxt/package*.json /nuxt

#RUN npx nuxi@latest init nuxt

#WORKDIR /nuxt

RUN npm install

#RUN npm install --save-exact @nuxtjs/auth-next

#RUN npm install @nuxtjs/axios

CMD ["npm","run","dev"]