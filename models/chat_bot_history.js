export default (sequelize, DataTypes) => {
  const chat_bot_history = sequelize.define(
    "chat_bot_history",
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
          model: "app_users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      bot_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      user_query: {
        type: DataTypes.TEXT,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("success", "failed"),
        defaultValue: "success",
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
      tableName: "chat_bot_history",
      timestamps: false,
    }
  );

//   chat_bot_history.sync({ alter: true });
  return chat_bot_history;
};
