# Node 24 (LTS) e non 20, per due motivi indipendenti:
# - Node 20 è fuori supporto dal 30 aprile 2026: niente più patch di sicurezza.
# - Tutti i pacchetti di NestJS 12 sono ESM-only. L'app, compilata in
#   CommonJS, li carica comunque anche su Node 20.19+ (require di moduli ESM),
#   ma il caricatore di moduli di JEST lo supporta solo da Node 24.9, e solo
#   con il flag --experimental-vm-modules (impostato nello script `test` di
#   package.json, non qui: serve al test runner, non all'app).
FROM node:24-alpine

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

# Genera il Prisma Client dentro node_modules/@prisma/client. Va fatto qui,
# nell'immagine, e non a runtime: /app/node_modules è un volume anonimo che
# viene inizializzato dal contenuto dell'immagine, quindi un client generato
# solo a runtime sparirebbe alla prima ricreazione del volume.
#
# Le variabili fittizie servono perché prisma.config.ts compone l'URL del
# database dalle variabili d'ambiente e si rifiuta di partire se mancano
# (nessun fallback, come per tutto il resto del progetto). `prisma generate`
# però non si connette al database: legge solo lo schema, quindi il valore
# reale qui è irrilevante. Passarle solo per questo comando evita di
# indebolire il controllo che protegge l'app a runtime.
RUN DB_USER=build DB_ROOT_PASSWORD=build DB_HOST=build DB_NAME=build \
    npx prisma generate

EXPOSE 5000 9229
CMD ["npm", "run", "dev"]