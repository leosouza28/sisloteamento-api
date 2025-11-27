import mongoose from "mongoose";

const ModelSchema = new mongoose.Schema({
    loteamento: {
        _id: String,
        nome: String,
    },
    mapa_virtual: String,
    lotes: [
        {
            id: String,
            x: Number,
            y: Number,
            width: Number,
            height: Number,
            quadra: String,
            numero: String,
            cor: String
        }
    ],
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

export const LoteamentosMapasModel = mongoose.model("loteamentos-mapas", ModelSchema);