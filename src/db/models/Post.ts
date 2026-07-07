import { Schema, model, type InferSchemaType } from "mongoose";

const postSchema = new Schema(
  {
    postId: { type: String, required: true, unique: true, index: true },
    profileUsername: { type: String, required: true, index: true },
    texto: { type: String, default: "" },
    url: { type: String, required: true },
    publicadoEm: { type: Date, default: null },
    tipoMidia: {
      type: String,
      enum: ["texto", "imagem", "video", "documento", "outro"],
      default: "texto",
    },
    midiaUrls: { type: [String], default: [] },
    reacoesCount: { type: Number, default: undefined },
    coletadoEm: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

postSchema.index({ profileUsername: 1, publicadoEm: -1 });

export type PostDocument = InferSchemaType<typeof postSchema>;

export const PostModel = model("Post", postSchema);
