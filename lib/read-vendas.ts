
import fs from 'fs';
import { isValidCPF, limpaValor } from './util';
import { LoteamentosModel } from './models/loteamentos.model';
import { USUARIO_MODEL_STATUS, USUARIO_MODEL_TIPO_TELEFONE, USUARIO_NIVEL, UsuariosModel } from './models/usuarios.model';
import { LOTE_SITUACAO, LotesModel } from './models/lotes.model';
import { RESERVA_SITUACAO, ReservasModel } from './models/reservas.model';
import dayjs from 'dayjs';

export default async () => {
    try {
        let csv = fs.readFileSync(__dirname + "/reservas-loteamento-vendas.csv", 'utf8');
        let headers = csv.split("\n")[0].split(",");
        let lines = csv.split("\n").slice(1);
        let resultados: any[] = [];
        for (let line of lines) {
            // Tem que escapar as virgulas dentro das aspas
            let valores: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let char of line) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    valores.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            valores.push(current);
            if (valores.length !== headers.length) {
                console.log('Linha ignorada por ter número incorreto de colunas:', line);
                continue;
            }
            let obj: any = {};
            for (let i = 0; i < headers.length; i++) {
                obj[headers[i].trim()] = valores[i].trim().replace(/^"|"$/g, '');
            }
            resultados.push(obj);
        }


        let loteamento = await LoteamentosModel.findOne({ _id: '6922abbfe19263510dddf7c1' }).lean();

        for (let r of resultados) {
            let data_reserva = r['DATA'] || "";
            data_reserva = data_reserva.split("/").reverse().join("-");
            let nome_cliente = r['NOME'];
            let doc_cliente = limpaValor(r['CPF']);
            let telefone_cliente = limpaValor(r['CONTATO']);
            let nome_vendedor = r['VENDEDOR'];
            let lote = r['LOTE'];
            let quadra = r['QUADRA'];
            if (!!doc_cliente) {

                if (lote && quadra) {
                    let _lote = pad3(Number(lote));
                    let _quadra = pad3(Number(quadra));
                    let loteamento_quadra_lote = `LOTEAMENTO-IPIRANGA-Q${_quadra}-L${_lote}`;
                    let loteamento_id = loteamento?._id.toString();
                    try {
                        isValidCPF(doc_cliente);
                        await upsertClienteReserva({
                            vendedor_nome: nome_vendedor,
                            cliente: {
                                nome: nome_cliente,
                                documento: doc_cliente,
                                telefone: telefone_cliente,
                            },
                            lote: {
                                quadra: _quadra,
                                lote: _lote,
                                loteamento_quadra_lote: loteamento_quadra_lote,
                                loteamento_id: loteamento_id,
                                situacao: r['SITUACAO']
                            },
                            data_reserva: data_reserva
                        }, loteamento)
                    } catch (error) {
                        // console.log("CPF inválido para o cliente:", nome_cliente, doc_cliente);
                    }
                } else {
                    // console.log("Lote ou quadra não informados para o cliente:", nome_cliente);
                }
            } else {
                console.log("Cliente sem CPF, ignorado:", nome_cliente);
            }
        }
        await LoteamentosModel.updateOne({
            _id: loteamento?._id
        }, {
            $set: {
                'livemap_sync': 0
            }
        })
        console.log("Processamento concluído.");
        // console.log(resultados)


    } catch (error) {
        console.log(error);
    }
}

async function upsertClienteReserva(data: any, loteamento: any) {
    console.log(data);
    let $set: any = {
        nome: data.cliente.nome,
        documento: data.cliente.documento,
        niveis: [USUARIO_NIVEL.CLIENTE],
        scopes: [],
        status: USUARIO_MODEL_STATUS.ATIVO,
        
    };
    if (data.cliente.telefone) {
        $set.telefone_principal = {
            tipo: USUARIO_MODEL_TIPO_TELEFONE.CEL_WHATSAPP,
            valor: data.cliente.telefone,
        };
        $set.telefones = [
            {
                tipo: USUARIO_MODEL_TIPO_TELEFONE.CEL_WHATSAPP,
                valor: data.cliente.telefone,
                principal: true
            }
        ]
    }
    let cliente = await UsuariosModel.findOneAndUpdate(
        {
            documento: data.cliente.documento
        },
        { $set: { ...$set } },
        { new: true, upsert: true }
    );
    let lote = await LotesModel.findOne({
        'loteamento._id': data.lote.loteamento_id,
        'loteamento_quadra_lote': data.lote.loteamento_quadra_lote
    })
    let codigo_reserva = `RES-${data.lote.loteamento_quadra_lote}`;
    let reserva = await ReservasModel.findOneAndUpdate(
        { 'codigo_reserva': codigo_reserva },
        {
            $set: {
                data_reserva: dayjs(data.data_reserva).toDate(),
                codigo_reserva: codigo_reserva,
                loteamento: loteamento,
                lotes: [lote],
                cliente,
                situacao: data.lote.situacao === 'VENDIDO' ? RESERVA_SITUACAO.CONCLUIDA : RESERVA_SITUACAO.ATIVA,
                criado_por: {
                    data_hora: dayjs().toDate(),
                    usuario: {
                        _id: "SISTEMA",
                        nome: "SISTEMA"
                    }
                }
            }
        },
        { upsert: true, new: true }
    )
    let updated = await LotesModel.updateOne(
        {
            'loteamento._id': data.lote.loteamento_id,
            'loteamento_quadra_lote': data.lote.loteamento_quadra_lote
        },
        {
            $set: {
                reserva: reserva,
                situacao: data.lote.situacao === 'VENDIDO' ? LOTE_SITUACAO.VENDIDO : LOTE_SITUACAO.RESERVADO
            }
        }
    )
    console.log(`(LOTE) Atualização ${updated.modifiedCount}/${updated.matchedCount}`);
}

function pad3(num: number): string {
    return num.toString().padStart(3, '0');
}