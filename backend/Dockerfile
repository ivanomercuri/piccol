FROM node:20-alpine

# Installiamo curl come root prima di cambiare utente
RUN apk add curl

# Creiamo la cartella e assegniamola subito all'utente 'node'
WORKDIR /app
RUN chown -R node:node /app

# --- DA QUI IN POI USIAMO L'UTENTE 'NODE' ---
USER node

# Copiamo i file assicurandoci che diventino di proprietà di 'node'
COPY --chown=node:node package*.json ./

# Ora npm install/ci viene eseguito come utente 'node', quindi i moduli saranno suoi!
RUN npm ci

# Copiamo il resto del codice, sempre come utente 'node'
COPY --chown=node:node . .

EXPOSE 5000 9229
CMD ["npm", "run", "dev"]