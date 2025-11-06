const {Customer} = require('../../models');
const {authenticate} = require("../../services/authService");
const {registerEntity} = require("../../services/registerService");
exports.register = async (req, res) => {
  const { email, password, firstName, lastName, address } = req.body;
  try {
    
    const token = await registerEntity(
      Customer,
      { email, password, firstName, lastName, address },
      ['id', 'email']
    );
    
    return res.success(token);
  } catch (error) {
    
    return res.error(500, error.message);
  }
}
exports.login = async (req, res) => {
  const {email, password} = req.body;
  try {
    
    const user = await authenticate(Customer, email, password);
    if (user.success) {
      
      return res.success(user.token);
    } else {
      
      return res.error(401, user.message);
    }
  } catch (error) {
    
    return res.error(500, error.message);
  }
};
