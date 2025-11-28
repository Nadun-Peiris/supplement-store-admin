import mongoose, { Schema, models } from "mongoose";

const CategorySchema = new Schema(
  {
    title: { type: String }, // admin DB
    name: { type: String },  // web DB fallback
    slug: { type: String, required: true },
    image: { type: String, default: "" },
  },
  { timestamps: true }
);

// Virtual: normalize "title" vs "name"
CategorySchema.virtual("displayName").get(function () {
  return this.title || this.name || "";
});

export default models.Category ||
  mongoose.model("Category", CategorySchema);
