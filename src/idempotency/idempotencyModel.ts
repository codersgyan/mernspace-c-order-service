import mongoose from "mongoose";

const idempotencySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
    },
    response: {
      type: Object,
      required: true,
    },
  },
  { timestamps: true },
);

// todo: change expireAfterSeconds time to 48 hours
idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 48 });
idempotencySchema.index({ key: 1 }, { unique: true });

export default mongoose.model("Idempotency", idempotencySchema);
