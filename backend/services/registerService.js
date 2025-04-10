const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function registerEntity(entityModel, userData, tokenPayloadFields) {
  const { password, ...otherFields } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);

  const newEntity = await entityModel.create({
    ...otherFields,
    password: hashedPassword
  });

  const tokenPayload = {};
  for (const field of tokenPayloadFields) {
    tokenPayload[field] = newEntity[field];
  }

  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  await newEntity.update({ current_token: token });

  return token;
}

module.exports = { registerEntity };
