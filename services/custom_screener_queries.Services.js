import moment from "moment/moment.js";
import db from "../models/index.js";
import { Op } from "sequelize";

export const get_all_screens = async (user_id) => {
  try {
    const queries = await db.custom_screener_queries.findAll({
      where: {
        [Op.or]: [{ user_id: user_id }, { user_id: { [Op.eq]: 0 } }],
      },
      order: [
        ["created_at", "DESC"],
        ["time", "DESC"],
      ],
    });
    const categorized_queries = {
      user_query: [],
      prebuild_query: [],
    };
    for (let query of queries) {
      const {
        id,
        user_id: saved_user_id,
        category,
        title,
        description,
        backend_query,
        frontend_query,
      } = query;

      if (saved_user_id === user_id) {
        categorized_queries.user_query.push({
          id,
          user_id,
          category,
          title,
          description,
          backend_query,
          frontend_query,
        });
      } else {
        categorized_queries.prebuild_query.push({
          id,
          user_id,
          category,
          title,
          description,
          backend_query,
          frontend_query,
        });
      }
    }
    return {
      res_status: 200,
      res: {
        status: 1,
        message: "Prebuild screens fetched successfully",
        data: categorized_queries,
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

export const get_search_screens = async (search) => {
  try {
    if (!search || search.trim() === "") {
      return {
        res_status: 400,
        res: {
          status: 1,
          message: "Provide valid search key!",
          data: null,
        },
      };
    }

    const whereClause = {
      [Op.and]: [
        { publish: true },
        {
          [Op.or]: [
            { title: { [Op.iLike]: `%${search}%` } },
            { description: { [Op.iLike]: `%${search}%` } },
          ]
        }
      ]
    };

    const screens = await db.custom_screener_queries.findAndCountAll({
      where: whereClause,
      order: [
        ["created_at", "DESC"],
        ["time", "DESC"],
      ],
    });

    return {
      res_status: 200,
      res: {
        status: 1,
        message:
          screens.count > 0
            ? "Screens fetched successfully"
            : "No screens found",
        data: screens.rows,
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

