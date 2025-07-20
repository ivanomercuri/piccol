// Export the User model definition
module.exports = (sequelize, DataTypes) => {
  // Define the User model schema
  const User = sequelize.define('User', {
    // User ID (primary key, auto-increment)
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    // User name
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // User email (must be unique)
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    level: {
      type: DataTypes.ENUM('superadmin', 'admin'),
      allowNull: false,
      defaultValue: 'admin'
    },
    // Hashed password
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Token for current session (optional)
    current_token: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null
    }
  }, {
    // Table configuration
    tableName: 'users',
    timestamps: true,
  });

  // Return the User model
  return User;
};

