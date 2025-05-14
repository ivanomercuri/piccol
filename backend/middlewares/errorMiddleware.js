
// Global error handling middleware
function errorHandler(err, req, res) {

  // Handle JSON syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.error(400, "errore json: " + err.message);
  }

  // Handle all other errors
  return res.error(err.status || 500, err.message || 'Qualcosa è andato storto!');
}

module.exports = errorHandler;
