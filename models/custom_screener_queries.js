export default (sequelize, DataTypes) => {
  const custom_screener_queries = sequelize.define(
    "custom_screener_queries",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "app_users", // table name or model name depending on config
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      backend_query: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      frontend_query: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      publish: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      time: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_TIME"),
      },
      created_at: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "custom_screener_queries",
      timestamps: false,
    }
  );

  // custom_screener_queries.sync({ alter: true });
  return custom_screener_queries;
};
