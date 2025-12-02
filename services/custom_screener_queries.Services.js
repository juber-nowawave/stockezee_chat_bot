import moment from "moment/moment.js";
import db from "../models/index.js";
import { Op } from "sequelize";

export const get_prebuild_screens = async () => {
  try {
    const queries = await db.custom_screener_queries.findAll({
      where: {
        user_id: 0,
        category: { [Op.ne]: "user made" },
      },
      order: [
        ["created_at", "DESC"],
        ["time", "DESC"],
      ],
    });

    let prebuild_query = {};
    for (let query of queries) {
      const {
        id,
        category,
        title,
        description,
        backend_query,
        frontend_query,
      } = query;

      prebuild_query[category] ??= [];
      prebuild_query[category].push({
        query_id: id,
        title,
        description,
        backend_query,
        frontend_query,
      });
    }
    return {
      res_status: 200,
      res: {
        status: 1,
        message: "Prebuild screens fetched successfully",
        data: prebuild_query,
      },
    };
  } catch (error) {
    console.error("Get prebuild screens error:", error);
    return {
      res_status: 500,
      res: {
        status: 0,
        message: "Internal server error. Please try again later.",
        data: null,
      },
    };
  }
};

export const get_user_screens = async (user_id) => {
  try {
    const queries = await db.custom_screener_queries.findAll({
      where: {
        user_id: user_id,
      },
      order: [
        ["created_at", "DESC"],
        ["time", "DESC"],
      ],
    });

    const user_query = [];
    for (let query of queries) {
      user_query.push({
        id: query.id,
        category: query.category,
        title: query.title,
        description: query.description,
        backend_query: query.backend_query,
        frontend_query: query.frontend_query,
      });
    }
    return {
      res_status: 200,
      res: {
        status: 1,
        message: "User screens fetched successfully",
        data: user_query,
      },
    };
  } catch (error) {
    console.error("Get User screens error:", error);
    return {
      res_status: 500,
      res: {
        status: 0,
        message: "Internal server error. Please try again later.",
        data: null,
      },
    };
  }
};

export const get_search_screens = async (search) => {
  try {
    let query = `
      SELECT csq.id, au.user_name, csq.user_id, csq.category, csq.title, csq.description,
      csq.backend_query, csq.frontend_query, csq.publish, csq.time, csq.created_at
      FROM custom_screener_queries csq
      INNER JOIN app_users au ON au.id = csq.user_id
      WHERE csq.publish = true
    `;

    let replacements = {};

    if (!search || search.trim() === "") {
      query += ` AND csq.category = 'user made'`;
    } else {
      query += ` AND (csq.title ILIKE :search OR csq.description ILIKE :search)`;
      replacements.search = `%${search}%`; // <-- Wildcard applied
    }

    query += ` ORDER BY csq.created_at DESC, csq.time DESC`;

    const screens = await db.sequelize.query(query, {
      replacements,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    return {
      res_status: 200,
      res: {
        status: screens.length > 0 ? 1 : 0,
        message: screens.length > 0 ? "Screens fetched successfully" : "No screens found",
        data: screens,
      },
    };
  } catch (error) {
    console.error("Get search screens error:", error);
    return {
      res_status: 500,
      res: {
        status: 0,
        message: "Internal server error. Please try again later.",
        data: null,
      },
    };
  }
};
  
export const post_user_screens = async (screenData) => {
  try {
    const {
      user_id,
      title,
      description,
      backend_query,
      frontend_query,
      publish = false,
    } = screenData;

    if (
      !user_id ||
      !title ||
      !description ||
      !backend_query ||
      !frontend_query
    ) {
      return {
        res_status: 400,
        res: {
          status: 0,
          message:
            "Missing required fields: user_id, category, title, description, backend_query, frontend_query",
          data: null,
        },
      };
    }
    const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");
    const current_time = moment().tz("Asia/kolkata").format("HH:mm:ss");
    const newScreen = await db.custom_screener_queries.create({
      user_id,
      title,
      category: "user made",
      description,
      backend_query,
      frontend_query,
      publish: publish || false,
      created_at: current_date,
      time: current_time,
    });

    return {
      res_status: 201,
      res: {
        status: 1,
        message: "Screen created successfully",
        data: newScreen,
      },
    };
  } catch (error) {
    console.error("Post user screens error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return {
        res_status: 409,
        res: {
          status: 0,
          message: "A screen with this title already exists",
          data: null,
        },
      };
    }

    return {
      res_status: 500,
      res: {
        status: 0,
        message: "Internal server error. Please try again later.",
        data: null,
      },
    };
  }
};

export const post_admin_screens = async (screenData) => {
  try {
    const newScreen = await db.custom_screener_queries.bulkCreate(screenData);

    return {
      res_status: 201,
      res: {
        status: 1,
        message: "Admin screen created and published successfully",
        data: newScreen,
      },
    };
  } catch (error) {
    console.error("Post admin screens error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return {
        res_status: 409,
        res: {
          status: 0,
          message: "A screen with this title already exists",
          data: null,
        },
      };
    }

    return {
      res_status: 500,
      res: {
        status: 0,
        message: "Internal server error. Please try again later.",
        data: null,
      },
    };
  }
};

export const edit_user_screens = async (screenId, updateData, userId) => {
  try {
    const screen = await db.custom_screener_queries.findOne({
      where: { id: screenId },
    });

    if (!screen) {
      return {
        res_status: 404,
        res: {
          status: 0,
          message: "Screen not found",
          data: null,
        },
      };
    }

    if (screen.user_id !== userId) {
      return {
        res_status: 403,
        res: {
          status: 0,
          message: "You don't have permission to edit this screen",
          data: null,
        },
      };
    }
    const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");
    const current_time = moment().tz("Asia/kolkata").format("HH:mm:ss");
    const allowedFields = [
      "title",
      "description",
      "backend_query",
      "frontend_query",
      "publish",
    ];

    let updateFields = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    });

    if (Object.keys(updateFields).length === 0) {
      return {
        res_status: 400,
        res: {
          status: 0,
          message: "No valid fields to update",
          data: null,
        },
      };
    }
    updateFields = {
      ...updateFields,
      created_at: current_date,
      time: current_time,
    };
    await screen.update(updateFields);

    return {
      res_status: 200,
      res: {
        status: 1,
        message: "Screen updated successfully",
        data: screen,
      },
    };
  } catch (error) {
    console.error("Edit user screens error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return {
        res_status: 409,
        res: {
          status: 0,
          message: "A screen with this title already exists",
          data: null,
        },
      };
    }

    return {
      res_status: 500,
      res: {
        status: 0,
        message: "Internal server error. Please try again later.",
        data: null,
      },
    };
  }
};

export const delete_user_screens = async (screenId, userId) => {
  try {
    const screen = await db.custom_screener_queries.findOne({
      where: { id: screenId },
    });

    if (!screen) {
      return {
        res_status: 404,
        res: {
          status: 0,
          message: "Screen not found",
          data: null,
        },
      };
    }

    if (screen.user_id !== userId) {
      return {
        res_status: 403,
        res: {
          status: 0,
          message: "You don't have permission to delete this screen",
          data: null,
        },
      };
    }

    await screen.destroy();

    return {
      res_status: 200,
      res: {
        status: 1,
        message: "Screen deleted successfully",
        data: { id: screenId },
      },
    };
  } catch (error) {
    console.error("Delete user screens error:", error);
    return {
      res_status: 500,
      res: {
        status: 0,
        message: "Internal server error. Please try again later.",
        data: null,
      },
    };
  }
};
