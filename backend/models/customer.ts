import {
  Model,
  Sequelize,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';

// Classe Sequelize v6 con InferAttributes/InferCreationAttributes: i campi
// dichiarati qui sotto con `declare` sono l'UNICA fonte di verità, sia per il
// tipo TypeScript sia (tramite Model.init più sotto) per gli attributi
// realmente registrati su Sequelize — a differenza di un'interfaccia scritta
// a mano, se un campo manca qui `Customer.init()` non compila più.
class Customer extends Model<
  InferAttributes<Customer>,
  InferCreationAttributes<Customer>
> {
  declare id: CreationOptional<number>;

  declare email: string;

  declare password: string;

  // allowNull: true e nessun defaultValue: opzionale in creazione (vedi
  // registerService.js, che non lo passa mai a .create() ma lo valorizza
  // dopo con .update()), può restare null per tutta la vita del record.
  declare current_token: CreationOptional<string | null>;

  declare firstName: string;

  declare lastName: string;

  declare address: CreationOptional<string | null>;

  declare readonly createdAt: CreationOptional<Date>;

  declare readonly updatedAt: CreationOptional<Date>;
}

// Firma invariata (sequelize, DataTypes) => ...: models/index.js chiama
// `require(file)(sequelize, Sequelize.DataTypes)` per ogni file in questa
// cartella, quindi manteniamo lo stesso "contratto di chiamata" per non dover
// toccare il loader in questa fase. Il tipo di DataTypes viene preso
// dall'import di sola-tipizzazione qui sotto, senza importare il valore
// (che arriva già come parametro, come nel file .js originale).
module.exports = (
  sequelize: Sequelize,
  DataTypes: typeof import('sequelize').DataTypes
) => {
  Customer.init(
    {
      // id/createdAt/updatedAt: Sequelize li aggiungerebbe comunque di
      // default (autoIncrement PK + timestamps, come nel .js originale, che
      // infatti non li dichiarava affatto). Qui vanno però resi espliciti
      // perché ModelAttributes<Customer, ...> richiede una entry per
      // OGNI campo dichiarato sulla classe (vedi i `declare` sopra) — non è
      // un cambio di comportamento, solo lo stesso default reso esplicito.
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      createdAt: DataTypes.DATE,

      updatedAt: DataTypes.DATE,

      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },

      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      current_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'customers',
      timestamps: true,
    }
  );

  return Customer;
};