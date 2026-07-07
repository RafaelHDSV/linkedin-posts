import { Schema, model, type InferSchemaType } from "mongoose";

const profileSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    url: { type: String, required: true },
    ativo: { type: Boolean, default: true },
    intervaloColetaHoras: { type: Number, default: 6 },
    ultimaColetaEm: { type: Date, default: null },
    ultimoStatus: {
      type: String,
      enum: ["sucesso", "erro"],
      default: null,
    },
    falhasConsecutivas: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type ProfileDocument = InferSchemaType<typeof profileSchema>;

export const ProfileModel = model("Profile", profileSchema);
