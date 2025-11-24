import mongoose from "mongoose";

const ModelSchema = new mongoose.Schema({
    loteamento_quadra_lote: String,
    quadra: String,
    lote: String,
    area: Number,
    valor_area: Number,
    valor_total: Number,
    valor_entrada: Number,
    situacao: String,
    loteamento: {
        _id: String,
        nome: String
    },
    reserva: {
        data_hora: Date,
        usuario: {
            _id: String,
            nome: String,
            documento: String
        }
    },
    exibivel: Boolean,
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

export const LotesModel = mongoose.model("lotes", ModelSchema);

export const LOTE_SITUACAO = {
    BLOQUEADO: 'BLOQUEADO',
    DISPONIVEL: 'DISPONIVEL',
    RESERVADO: 'RESERVADO',
    VENDIDO: 'VENDIDO'
}
