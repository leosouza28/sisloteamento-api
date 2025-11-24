import mongoose from "mongoose";

const ModelSchema = new mongoose.Schema({
    codigo_reserva: String,
    loteamento: {
        _id: String,
        nome: String
    },
    lotes: [
        {
            loteamento_quadra_lote: String,
            quadra: String,
            lote: String,
            area: Number,
            valor_area: Number,
            valor_total: Number,
            valor_entrada: Number
        }
    ],
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
    vendedor: {
        _id: String,
        nome: String,
        documento: String
    },
    situacao: String,
    criado_por: {
        data_hora: Date,
        usuario: {
            _id: String,
            nome: String,
            documento: String
        }
    },
    atualizado_por: {
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

export const ReservasModel = mongoose.model("reservas", ModelSchema);

export const RESERVA_SITUACAO = {
    "ATIVA": "ATIVA",
    "CANCELADA": "CANCELADA",
    "CONCLUIDA": "CONCLUIDA"
}