
import fs from 'fs';
import { isValidCPF, limpaValor } from './util';
import { LoteamentosModel } from './models/loteamentos.model';
import { USUARIO_MODEL_TIPO_TELEFONE, UsuariosModel } from './models/usuarios.model';
import { LOTE_SITUACAO, LotesModel } from './models/lotes.model';
import { RESERVA_SITUACAO, ReservasModel } from './models/reservas.model';
import dayjs from 'dayjs';

export default async () => {
    try {
        let csv = fs.readFileSync(__dirname + "/LOTES-BLOQUEADOS.csv", 'utf8');
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

        console.log(`Iniciando o processamento de ${resultados.length} lotes bloqueados...`);
        for (let item of resultados) {
            console.log(item);
            if (item?.SITUACAO == 'B') {
                let _lote = await LotesModel.findOne({
                    'loteamento._id': loteamento?._id.toString(),
                    'quadra': pad3(Number(item['QD'])),
                    'lote': pad3(Number(item['LT']))
                })
                if (_lote?.situacao == LOTE_SITUACAO.DISPONIVEL) {
                    await LotesModel.updateOne({
                        _id: _lote._id
                    }, {
                        $set: {
                            situacao: LOTE_SITUACAO.BLOQUEADO
                        }
                    });
                    console.log(`Lote bloqueado: QD ${item['QD']} LT ${item['LT']}`);
                } else {
                    console.log(`Lote já está bloqueado ou não encontrado: QD ${item['QD']} LT ${item['LT']}`);
                }
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

    } catch (error) {
        console.log(error);
    }
}


function pad3(num: number): string {
    return num.toString().padStart(3, '0');
}