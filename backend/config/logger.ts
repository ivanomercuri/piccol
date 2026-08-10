import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
    format.prettyPrint()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

// `export =` (non `export default`): questo modulo continua a essere
// richiesto da file .js non ancora convertiti con `const logger =
// require('../config/logger')`, cioè si aspettano che il valore esportato
// SIA il logger stesso. Con `export default` il compilatore avrebbe invece
// prodotto `exports.default = logger`, e quei `require()` avrebbero preso
// l'intero modulo (con `.default` da svolgere) invece del logger.
export = logger;