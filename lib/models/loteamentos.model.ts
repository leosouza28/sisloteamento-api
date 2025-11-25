import mongoose from "mongoose";

const ModelSchema = new mongoose.Schema({
    slug: String,
    nome: String,
    descricao: String,
    cidade: String,
    estado: String,

    mapa_empreendimento: String,
    
    quantidade_quadras: Number,
    quantidade_lotes: Number,
    valor_total_lotes: Number,

    status: String,

    criado_por: {
        data_hora: Date,
        usuario: {
            _id: String,
            nome: String,
            documento: String
        }
    },
    alterado_por: {
        data_hora: Date,
        usuario: {
            _id: String,
            nome: String,
            documento: String
        }
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

export const LoteamentosModel = mongoose.model("loteamentos", ModelSchema);

export const LOTEAMENTO_STATUS = {
    ATIVO: 'ATIVO',
    BLOQUEADO: 'BLOQUEADO',
}