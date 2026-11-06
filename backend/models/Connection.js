
const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    type: {
      type: String,
      required: true,
      enum: ["SQLServer", "HANA", "ServiceLayer"]
    },

    host: {
      type: String,
      required: true,
      trim: true
    },

    port: {
      type: Number,
      required: true,
      min: 1,
      max: 65535
    },

    database: {
      type: String,
      required: true,
      trim: true
    },

    username: {
      type: String,
      required: true,
      trim: true
    },

    passwordEncrypted: {
      type: String,
      required: true,
      select: false
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    lastTestStatus: {
      type: String,
      enum: ["NOT_TESTED", "SUCCESS", "FAILED"],
      default: "NOT_TESTED"
    },

    lastTestedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,

    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordEncrypted;
        return ret;
      }
    },

    toObject: {
      transform: (doc, ret) => {
        delete ret.passwordEncrypted;
        return ret;
      }
    }
  }
);

const Connection = mongoose.model(
  "Connection",
  connectionSchema
);

module.exports = Connection;
