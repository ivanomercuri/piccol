
// Middleware to handle 404 Not Found for undefined routes
module.exports = (req, res) => {
  return res.error(404, "Non trovato");
};
