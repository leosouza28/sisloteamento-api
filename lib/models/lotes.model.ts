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
        _id: String,
        data_reserva: Date,
        codigo_reserva: String,
        vendedor: {
            _id: String,
            nome: String,
            documento: String
        },
        cliente: {
            _id: String,
            nome: String,
            email: String,
            data_nascimento: Date,
            documento: String,
            sexo: String,
            telefone_principal: {
                tipo: String,
                valor: String
            },
            endereco: {
                cep: String,
                logradouro: String,
                numero: String,
                complemento: String,
                bairro: String,
                cidade: String,
                estado: String,
            }
        },
        situacao: String
    },
    situacao_csv: String,
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
