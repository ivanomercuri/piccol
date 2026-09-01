import app from './index';

// Nessun fallback silenzioso: PORT deve arrivare da .env (docker-compose.yml
// stesso si rifiuta di partire se manca, vedi "${PORT:?...}" lì). Se in
// qualche modo il processo viene avviato senza — es. un'esecuzione diretta
// sull'host che bypassa Docker Compose — meglio fermarsi qui con un errore
// leggibile che scegliere una porta a caso o una a sorpresa.
const rawPort = process.env.PORT;
const PORT = Number(rawPort);

if (!rawPort || Number.isNaN(PORT)) {
  console.error(
    'Missing or invalid PORT environment variable. Set it in .env before starting the server.'
  );

  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});