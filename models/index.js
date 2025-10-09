import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const db = {};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    timezone: "+05:30",
    logging: false,
  }
);

try {
  await sequelize.authenticate();
  console.log("Database connected successfully.");
} catch (error) {
  console.error("Database connection error:", error);
}

const modelFiles = fs
  .readdirSync(__dirname)
  .filter(
    (file) =>
      file.indexOf(".") !== 0 &&
      file !== basename &&
      file.slice(-3) === ".js" &&
      !file.includes(".test.js")
  );

for (const file of modelFiles) {
  const modelPath = path.join(__dirname, file);
  const { default: modelDefiner } = await import(modelPath);
  const model = modelDefiner(sequelize, Sequelize.DataTypes);
  db[model.name] = model;
}

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
