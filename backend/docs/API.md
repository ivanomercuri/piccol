# API Piccol

Documentazione delle API REST esposte dal backend Express di Piccol. Base URL locale (fuori Docker):
`http://localhost:5000`; via Docker Compose il backend è esposto su `http://localhost:5001` (mappato sulla
porta interna 5000, vedi `docker-compose.yml`).

Tutte le route restituiscono JSON. Non esiste ancora versionamento delle API (nessun prefisso `/v1`).

## Indice

- [Formato delle risposte](#formato-delle-risposte)
- [Autenticazione](#autenticazione)
- [Customer API](#customer-api-mounted-at-)
- [Admin / User API](#admin--user-api-mounted-at-adminuser)
- [Product API](#product-api-mounted-at-products)
- [Route di debug](#route-di-debug)
- [Problemi noti / comportamenti da tenere a mente](#problemi-noti--comportamenti-da-tenere-a-mente)

## Formato delle risposte

Ogni risposta passa da `middlewares/responseFormatter.js`, che imposta due helper (`res.success` /
`res.error`) usati da tutti i controller. Il formato è quindi sempre uno di questi due:

**Successo** (`res.success(data, message, code)`, `code` di default 200):

```json
{
  "success": true,
  "status": 200,
  "data": {},
  "message": ""
}
```

**Errore** (`res.error(code, message, err)`, `code` di default 500):

```json
{
  "success": false,
  "status": 400,
  "data": null,
  "error": "Testo o array di errori"
}
```

Il campo `error` può essere:

- una **stringa** semplice (es. errori 401/403/500 generati direttamente dai controller);
- un **array di errori raggruppati per campo**, prodotto da `middlewares/validationHandlerMiddleware.js`
  quando falliscono le validazioni di `express-validator` e/o quelle accumulate su
  `req.validationErrors` (upload immagini). Esempio:

  ```json
  {
    "success": false,
    "status": 400,
    "data": null,
    "error": [
      { "id": "name", "message": "Nome del prodotto è richiesto" },
      {
        "id": "image",
        "message": [
          { "filename": "_generale_", "message": "L'immagine del prodotto è richiesta" }
        ]
      }
    ]
  }
  ```

  Gli errori sul campo `image` sono sempre raggruppati in un oggetto `{ id: 'image', message: [...] }`
  con un elemento per file coinvolto (`filename` vale `'_generale_'` quando l'errore non riguarda un file
  specifico, es. "immagine mancante").

Quando un errore "fatale" viene rilevato durante l'upload (es. superamento dell'hard limit Multer), la
risposta salta il raggruppamento e restituisce direttamente `error` come stringa singola con codice 400.

Quando viene passata un'istanza di `Error` a `res.error`, questa viene loggata via Winston
(`backend/logs/error.log` e `combined.log`) — il messaggio dell'errore non finisce necessariamente nella
risposta HTTP se il controller passa un messaggio custom.

## Autenticazione

Il progetto ha **due entità autenticate parallele e indipendenti** (tabelle, route e controller separati —
non una gerarchia condivisa):

- **User** — account interni/admin (`level`: `admin` o `superadmin`), route sotto `/admin/user`.
- **Customer** — clienti dello storefront, route sotto `/`.

Entrambe usano JWT firmati con `JWT_SECRET` (env var). Il token va passato nell'header:

```
Authorization: Bearer <token>
```

Solo le route **User** sono attualmente protette da un middleware di autenticazione
(`authUserMiddleware`): non esiste un middleware equivalente per `Customer`, quindi al momento non ci sono
route customer protette da login (vedi [Problemi noti](#problemi-noti--comportamenti-da-tenere-a-mente)).

`authUserMiddleware` verifica il JWT **e** che coincida con la colonna `current_token` sul record `User`
nel DB — un token è quindi valido solo se è l'ultimo emesso per quell'utente (permette l'invalidazione al
logout). Risposte di errore possibili su qualunque route protetta:

| Condizione | Status | `error` |
|---|---|---|
| Header `Authorization` assente | 401 | `Token mancante` |
| Header presente ma senza token dopo lo split su spazio | 401 | `Formato token non valido` |
| JWT scaduto o firma non valida | 401 | `Token scaduto o non valido` |
| Utente decodificato non esiste più nel DB | 401 | `Utente non trovato` |
| Token valido ma diverso da `current_token` (es. dopo logout) | 401 | `Token non più valido` |

---

## Customer API (mounted at `/`)

Definite in `routes/customerRoutes.js`, controller in `controllers/customer/authCustomerController.js`.

### `GET /`

Route di health-check, nessuna autenticazione.

- **200** → `data`: la stringa `"𝕴𝖙 𝖂𝖔𝖗𝖐𝖘!"`

### `POST /register`

Registra un nuovo cliente storefront.

**Body** (JSON):

| Campo | Tipo | Obbligatorio |
|---|---|---|
| `email` | string | sì |
| `password` | string | sì |
| `firstName` | string | sì |
| `lastName` | string | sì |
| `address` | string | sì |

- **200** → `data`: token JWT (stringa), payload `{ id, email }`, **scade dopo 1 ora**
  (`services/tokenService.js`, stessa policy usata da tutti gli endpoint di login/registrazione)
- **400** → errori di validazione raggruppati per campo (uno per campo mancante)
- **500** → errore generico (es. email già registrata → violazione `unique` a livello DB, il messaggio
  Sequelize grezzo finisce in `error`, non un messaggio "amichevole" in italiano)

### `POST /login`

**Body** (JSON):

| Campo | Tipo | Obbligatorio |
|---|---|---|
| `email` | string | sì |
| `password` | string | sì |

- **200** → `data`: token JWT (stringa), payload `{ id, email }`, **scade dopo 1 ora**
  (`services/tokenService.js`)
- **400** → errori di validazione (campi mancanti)
- **401** → `Utente non trovato` oppure `Password errata`
- **500** → errore generico

> Non esistono ancora endpoint per profilo, cambio password o logout del Customer — il file
> `controllers/customer/profileCustomerController.js` esiste ma è vuoto e non è collegato a nessuna route.

---

## Admin / User API (mounted at `/admin/user`)

Definite in `routes/userRoutes.js` (montate da `routes/adminRoutes.js` sotto `/admin/user`), controller in
`controllers/user/authUserController.js` e `controllers/user/profileUserController.js`.

### `POST /admin/user/register`

**Body** (JSON):

| Campo | Tipo | Obbligatorio |
|---|---|---|
| `name` | string | sì |
| `email` | string | sì |
| `password` | string | sì |

- **200** → `data`: token JWT, payload `{ id, email }`, **scade dopo 1 ora**
- **400** → errori di validazione
- **500** → errore generico (es. email duplicata)

Nota: `level` non è impostabile in registrazione — viene sempre creato come `admin` (default del modello
`User`); non esiste un endpoint per creare un `superadmin`, va fatto manualmente sul DB.

### `POST /admin/user/login`

**Body** (JSON): `email`, `password` (entrambi obbligatori).

- **200** → `data`: token JWT, payload `{ id, email }`, **scade dopo 1 ora**
- **400** → errori di validazione
- **401** → `Utente non trovato` oppure `Password errata`
- **500** → errore generico

### `GET /admin/user` 🔒

Richiede `Authorization: Bearer <token>`.

- **200** → `data`: `{ id, name, email, level }`

### `PATCH /admin/user` 🔒

Aggiorna nome/email del proprio profilo.

**Body** (JSON):

| Campo | Tipo | Obbligatorio |
|---|---|---|
| `name` | string | sì (per il validator) |
| `email` | string | sì (per il validator) |

- **200** → `data`: `{ id, name, email }`
- **400** → errori di validazione
- **500** → `Errore durante l'aggiornamento del profilo`

> Il validator richiede **entrambi** i campi non vuoti, anche se il controller supporta di fatto
> l'aggiornamento parziale (`if (name) user.name = name`). In pratica oggi non è possibile aggiornare solo
> `name` o solo `email` in una singola richiesta, perché la validazione blocca prima la richiesta.

### `PATCH /admin/user/password` 🔒

**Body** (JSON): `oldPassword`, `newPassword` (entrambi obbligatori).

- **200** → `data: {}`, `message: "Password aggiornata con successo"`
- **400** → `La vecchia password non corrisponde` (oltre ai normali errori di validazione sui campi mancanti)
- **500** → `Errore durante il cambio della password`

> ⚠️ Questo endpoint **non invalida `current_token`**: il vecchio JWT continua a funzionare anche dopo il
> cambio password. Questo contraddice il pattern di invalidazione descritto in `CLAUDE.md`
> ("i flussi di password/2FA dovrebbero fare lo stesso" del logout, cioè azzerare `current_token`) — vedi
> [Problemi noti](#problemi-noti--comportamenti-da-tenere-a-mente).

### `POST /admin/user/logout` 🔒

- **200** → `data: {}`, `message: "Logout effettuato con successo"`. Imposta `current_token = null`: da
  questo momento il vecchio token restituisce `401 Token non più valido` su qualsiasi route protetta.
- **500** → `Errore durante il logout`

---

## Product API (mounted at `/products`)

Definite in `routes/productRoutes.js`, controller in `controllers/product/productController.js`. Tutte le
route richiedono autenticazione **User** (`authUserMiddleware`); non sono accessibili ai `Customer`.

### `GET /products` 🔒

- Se `req.user.level === 'superadmin'` → restituisce **tutti** i prodotti.
- Se `req.user.level === 'admin'` → restituisce solo i prodotti con `createdBy === req.user.id`.
- Qualsiasi altro valore di `level` (non raggiungibile oggi, dato che l'enum del modello è solo
  `admin`/`superadmin`) → **403** `Non autorizzato`.

- **200** → `data`: array di prodotti (`id`, `name`, `description`, `price`, `quantity`, `available`,
  `sku`, `createdBy`, `createdAt`, `updatedAt`)
- **403** → `Errore server` in caso di eccezione (nota: usa 403 anche per errori generici, non 500 — vedi
  [Problemi noti](#problemi-noti--comportamenti-da-tenere-a-mente))

### `POST /products/new` 🔒 ⚠️ **STUB — non crea nulla**

Route `multipart/form-data`. Pipeline completa di validazione già collegata (vedi
`routes/productRoutes.js`):

1. `uploadImage.array('image')` — Multer, accetta solo `image/jpeg`/`image/png`, hard limit 10 MB per file.
2. `handleMulterErrorsMiddleware` — intercetta errori Multer (es. hard limit superato → errore "fatale").
3. `checkNumberFilesMiddleware('image', 1, ...)` — **massimo 1 file** sul campo `image`.
4. `validateProductImageMiddleware` — limite di dimensione "business" da `MAX_FILE_SIZE` (env, MB),
   dimensioni massime `1920x1080` px (`config/imageConfig.js`), immagine **obbligatoria**.
5. Validazione campi testuali via `express-validator`.

**Campo file**: `image` (esattamente 1 file, jpeg o png).

**Body** (form-data):

| Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `name` | string | sì | |
| `description` | string | sì | |
| `price` | numero | sì | validato con `isNumeric()` |
| `quantity` | intero | sì | validato con `isInt({ gt: 0 })`, deve essere > 0 |

- **400** → errori di validazione raggruppati (campi e/o immagine)
- **200** → **anche se tutte le validazioni passano, il controller è uno stub**:
  `exports.createProduct = async (req, res) => { return res.success({}); }` — non viene creata nessuna
  riga in `products`, il file caricato resta nella cartella `uploads/` e non viene mai ripulito né
  referenziato da nessuna parte.

---

## Route di debug

### `GET /routes`

Non montata sotto nessun prefisso (`app.use(listRoutes)` in `index.js`), quindi raggiungibile a
`GET /routes` sulla root del server.

- Se `SHOW_ROUTES` (env) non è esattamente `"true"` → **403** `Accesso negato`.
- Se abilitata → stampa l'elenco delle route registrate sulla **console del server** (`console.debug`) e
  risponde comunque con `data: []` — il corpo della risposta HTTP **non contiene mai** l'elenco delle
  route, va letto nei log del processo. Pensata solo per debug locale/fuori produzione.

---

## Problemi noti / comportamenti da tenere a mente

Elenco di comportamenti reali del codice attuale che vale la pena conoscere prima di integrare o estendere
queste API (non sono bug "nascosti": sono osservabili leggendo il codice, ma facili da non notare):

- **`POST /products/new` è uno stub**: risponde 200 senza creare nulla. Vedi anche
  `CLAUDE.md` → "Parte nota come incompleta".
- **Il cambio password non invalida il token corrente**: `PATCH /admin/user/password` non tocca
  `current_token`, quindi un vecchio JWT resta valido anche dopo il cambio password — al contrario di
  quanto succede al logout.
- **`GET /products` restituisce 403 anche per errori inattesi**, non solo per autorizzazione mancante (il
  blocco `catch` chiama `res.error(403, 'Errore server', err)` invece di 500).
- **Nessuna route di autenticazione protetta per `Customer`**: non esiste un `authCustomerMiddleware`, né
  endpoint di profilo/logout/cambio password lato storefront, nonostante il modello `Customer` abbia già
  la colonna `current_token` predisposta per lo stesso pattern usato da `User`.
- **`PATCH /admin/user` richiede sempre sia `name` che `email`** anche se il controller supporterebbe
  l'aggiornamento parziale — la validazione a monte lo impedisce nella pratica.
- **I file caricati per un prodotto non vengono mai ripuliti** in caso di successo della validazione, dato
  che `createProduct` non li usa né li elimina: restano accumulati in `backend/uploads/` (già visibile nel
  repo attuale con alcuni file di test manuali).