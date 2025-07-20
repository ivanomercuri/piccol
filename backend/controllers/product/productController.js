const { Product } = require('../../models');

exports.getProducts = async (req, res) => {
  try {
    let products;
    if (req.user.level === 'superadmin') {
      products = await Product.findAll();
    } else if (req.user.level === 'admin') {
      products = await Product.findAll({
        where: { createdBy: req.user.id }
      });
    } else {
      return res.error(403, 'Non autorizzato');
    }
    return res.success(products);
  } catch (err) {
    return res.error(403, 'Errore server', err);
  }
}

exports.createProduct = async (req, res) => {

}