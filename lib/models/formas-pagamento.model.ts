import mongoose from "mongoose";

const ModelSchema = new mongoose.Schema({
    nome: String,
    situacao_inicial: String,
    dias_parcelas: {
        type: Number,
        default: 0
    },
    max_parcelas: {
        type: Number,
        default: 1
    },
    status: String,
    status_pdv_ingressos: String,
    status_pdv_planos: String,
    status_ecommerce: String,
}, {
    timestamps: {
        createdAt: "createdAt",
        updatedAt: "updatedAt"
    }
});

export const FormasPagamentosModel = mongoose.model("formas-pagamentos", ModelSchema);

export const FORMA_PAGAMENTO_STATUS = {
    ATIVO: "ATIVO",
    BLOQUEADO: "BLOQUEADO",
}