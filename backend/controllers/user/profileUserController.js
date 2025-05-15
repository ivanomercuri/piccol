exports.getProfileUser = (req, res) => {
  const {user} = req;
  if (!user) {
    return res.error(401, 'Utente non trovato');
  }
  const {id, name, email} = user;
  const returnUser = {id, name, email};
  return res.success(returnUser);
}
