import app from './index';

// Porta di fallback, usata solo se PORT non è impostata nell'ambiente.
// Coincide deliberatamente con la porta interna già cablata altrove
// (EXPOSE nel Dockerfile, mappatura "5001:5000" in docker-compose.yml): se
// cambi questo valore in produzione va aggiornata anche quella mappatura,
// dato che Docker non ha modo di leggere PORT da .env per conto proprio.
const DEFAULT_PORT = 5000;

// process.env.PORT è sempre una stringa (o undefined): la convertiamo
// esplicitamente in numero. Se manca, o non è un numero valido (es. un
// refuso nel .env), ricadiamo sul default invece di passare NaN a
// app.listen(), che altrimenti farebbe scegliere una porta casuale a Node
// senza nessun avviso.
const envPort = Number(process.env.PORT);
const PORT =
  process.env.PORT && !Number.isNaN(envPort) ? envPort : DEFAULT_PORT;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});