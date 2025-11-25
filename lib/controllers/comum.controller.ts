import axios from "axios";
import { NextFunction, Request, Response } from "express";
import { MunicipiosModel } from "../models/municipios.model";
import { errorHandler, logDev, MoneyBRL } from "../util";
import fileUpload from "express-fileupload";
import { storage } from "../integrations/firebase";
import { USUARIO_NIVEL, UsuariosModel } from "../models/usuarios.model";
import { isScopeAuthorized } from "../oauth/permissions";
import { FORMA_PAGAMENTO_STATUS, FormasPagamentosModel } from "../models/formas-pagamento.model";
import { LOTE_SITUACAO, LotesModel } from "../models/lotes.model";
import { LOTEAMENTO_STATUS, LoteamentosModel } from "../models/loteamentos.model";
import { RESERVA_SITUACAO, ReservasModel } from "../models/reservas.model";

export default {
    admin: {
        getDashboardAdmin: async (req: Request, res: Response, next: NextFunction) => {
            try {
                let response = {};
                // Total de Lotes Cadastrados
                let lotes = await LotesModel.find({
                    'situacao': {
                        $in: [
                            LOTE_SITUACAO.VENDIDO,
                            LOTE_SITUACAO.RESERVADO,
                            LOTE_SITUACAO.DISPONIVEL,
                            LOTE_SITUACAO.BLOQUEADO
                        ]
                    },
                    'exibivel': true
                });
                // Total de Lotes Vendidos
                let lotes_vendidos = lotes.filter((lote: any) => lote.situacao == LOTE_SITUACAO.VENDIDO);
                let total_lotes_vendidos = lotes_vendidos.length;
                // Total de Lotes Reservados
                let lotes_reservados = lotes.filter((lote: any) => lote.situacao == LOTE_SITUACAO.RESERVADO);
                let total_lotes_reservados = lotes_reservados.length;
                // Total de Loteamentos Ativos
                let loteamentos = await LoteamentosModel.find({ status: LOTEAMENTO_STATUS.ATIVO }).lean();
                let total_loteamentos_ativos = loteamentos.length;
                let total_clientes_base = await UsuariosModel.find({ niveis: USUARIO_NIVEL.CLIENTE }).countDocuments();
                let total_vendedores_base = await UsuariosModel.find({ niveis: USUARIO_NIVEL.VENDEDOR }).countDocuments();
                let total_reservas_ativas = await ReservasModel.find({ 'situacao': RESERVA_SITUACAO.ATIVA }).countDocuments();
                let total_reservas_vendidas = await ReservasModel.find({ 'situacao': RESERVA_SITUACAO.CONCLUIDA }).countDocuments();
                let total_reservas = await ReservasModel.find().countDocuments();
                let ultimas_reservas = await ReservasModel.find().sort({ createdAt: -1 }).limit(10).lean();
                response = {
                    total_lotes_cadastrados: lotes.length,
                    total_lotes_vendidos,
                    total_lotes_reservados,
                    total_loteamentos_ativos,
                    total_clientes_base,
                    total_vendedores_base,
                    total_reservas_ativas,
                    total_reservas_vendidas,
                    total_reservas,
                    lista_ultimas_reservas: ultimas_reservas
                }

                res.json(response);
            } catch (error) {
                errorHandler(error, res);
            }
        },
        upload: async (req: Request, res: Response, next: NextFunction) => {
            try {
                let url = '';
                if (Object.keys(req?.files || {}).length) {
                    for (let item in req.files) {
                        let file;
                        if (!Array.isArray(req.files[item])) {
                            file = req.files[item] as fileUpload.UploadedFile;
                            let fileName = file.name;
                            let storageFile = storage.file(`sisloteamentos/${fileName}`);
                            let counter = 1;

                            while ((await storageFile.exists())[0]) {
                                const extensionIndex = fileName.lastIndexOf('.');
                                const baseName = extensionIndex !== -1 ? fileName.substring(0, extensionIndex) : fileName;
                                const extension = extensionIndex !== -1 ? fileName.substring(extensionIndex) : '';
                                fileName = `${baseName}(${counter})${extension}`;
                                storageFile = storage.file(`imgs/${fileName}`);
                                counter++;
                            }
                            await storageFile.save(file.data, { metadata: { 'contentType': file.mimetype } });
                            await storageFile.makePublic();
                            url = storageFile.publicUrl();
                        }
                    }
                }
                let decoded_url = decodeURIComponent(url);
                res.json({ url: decoded_url })
            } catch (error) {
                errorHandler(error, res);
            }
        },

    },
    configuracoes: {
        getFormasPagamentoDisponiveis: async (req: Request, res: Response, next: NextFunction) => {
            try {
                let { perpage, page, origem_venda } = req.query
                let lista: any = [], total = 0, find: any = {};
                if (!origem_venda) throw new Error("Informe a origem da venda!")

                if (origem_venda == 'pdv_ingressos') {
                    find['status'] = FORMA_PAGAMENTO_STATUS.ATIVO;
                    find['status_pdv_ingressos'] = FORMA_PAGAMENTO_STATUS.ATIVO;
                }
                if (origem_venda == 'ecommerce') {
                    find['status'] = FORMA_PAGAMENTO_STATUS.ATIVO;
                    find['status_ecommerce'] = FORMA_PAGAMENTO_STATUS.ATIVO;
                }
                if (origem_venda == 'pdv_planos') {
                    find['status'] = FORMA_PAGAMENTO_STATUS.ATIVO;
                    find['status_pdv_planos'] = FORMA_PAGAMENTO_STATUS.ATIVO;
                }

                total = await FormasPagamentosModel.find(find).countDocuments();
                lista = await FormasPagamentosModel.find(find)

                res.json({ lista, total })
            } catch (error) {
                errorHandler(error, res);
            }
        },
        getFormasPagamento: async (req: Request, res: Response, next: NextFunction) => {
            try {
                let { perpage, page } = req.query
                let lista: any = [], total = 0,
                    porpagina = 10, pagina = 0, skip = 0, limit = 0;
                if (perpage && page) {
                    porpagina = Number(perpage);
                    pagina = Number(page);
                    pagina--
                    skip = porpagina * pagina;
                    limit = porpagina;
                }
                let find = {}

                total = await FormasPagamentosModel.find(find).countDocuments();
                lista = await FormasPagamentosModel.find(find)
                    .skip(skip)
                    .limit(limit)
                    .sort({ createdAt: -1 })
                    .lean();

                res.json({ lista, total })
            } catch (error) {
                errorHandler(error, res);
            }
        },
        addFormaPagamento: async (req: Request, res: Response, next: NextFunction) => {
            try {
                let { _id, ...data } = req.body;
                if (!data?.nome) throw new Error("Informe um nome!");
                if (_id) {
                    let find = await FormasPagamentosModel.findById(_id);
                    if (!find) throw new Error("Forma de pagamento não encontrada");
                    await FormasPagamentosModel.findByIdAndUpdate(_id, { $set: { ...data } });
                } else {
                    let find = await FormasPagamentosModel.findOne({ nome: data.nome });
                    if (find) throw new Error("Forma de pagamento já cadastrada");
                    let formaPagamento = new FormasPagamentosModel(data);
                    await formaPagamento.save();
                }
                res.json(true);
            } catch (error) {
                errorHandler(error, res);
            }
        },
    },

    getConsultaCEP: async (req: Request, res: Response, next: NextFunction) => {
        try {
            let { cep } = req.query;
            if (!cep) throw new Error("CEP não informado");
            let response;
            try {
                let resp = await axios({
                    method: 'get',
                    url: `https://viacep.com.br/ws/${cep}/json/`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                })
                if (!!resp?.data?.logradouro) response = resp.data;
            } catch (error) {
                logDev(error);
                throw new Error(`Erro ao consultar o CEP`);
            }
            if (!response) throw new Error(`Não foi possível consultar o CEP`);
            res.json(response);
        } catch (error) {
            errorHandler(error, res)
        }
    },
    getDefaultValues: async (req: Request, res: Response, next: NextFunction) => {
        try {
            let sexos = [
                { label: "Não informar", value: 'NAO_INFORMAR' },
                { label: "Masculino", value: 'MASCULINO' },
                { label: "Feminino", value: 'FEMININO' }
            ];
            let parentescos = [
                "PAI",
                "MÃE",
                "FILHO",
                "FILHA",
                "AVÔ",
                "AVÓ",
                "MARIDO",
                "ESPOSA",
                "NETO",
                "NETA",
                "IRMÃO",
                "IRMÃ",
                "SOGRO",
                "SOGRA",
                "GENRO",
                "NORA",
                "ENTEADO",
                "ENTEADA",
                "CUNHADO",
                "CUNHADA",
                "AVÔ DO CÔNJUGE",
                "AVÓ DO CÔNJUGE",
                "NETO DO CÔNJUGE",
                "NETA DO CÔNJUGE",
                "OUTRO",
            ].sort(
                (a: string, b: string) => {
                    if (a < b) return -1;
                    if (a > b) return 1;
                    return 0;
                }
            );


            let niveis_acesso = Object.keys(USUARIO_NIVEL).map((key: string) => {
                return {
                    // @ts-ignore
                    label: USUARIO_NIVEL[key],
                    value: key
                }
            })

            res.json({
                sexos,
                parentescos,
                niveis_acesso
            })
        } catch (error) {
            errorHandler(error, res);
        }
    },
    getEstados: async (req: Request, res: Response, next: NextFunction) => {
        try {
            let estados = await MunicipiosModel.aggregate([
                {
                    $group: {
                        _id: "$estado",
                        nome: { $first: "$estado.nome" },
                        sigla: { $first: "$estado.sigla" }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        nome: 1,
                        sigla: 1
                    }
                },
                { $sort: { sigla: 1 } }
            ])
            res.json(estados);
        } catch (error) {
            errorHandler(error, res)
        }
    },
    getCidades: async (req: Request, res: Response, next: NextFunction) => {
        try {
            let estado = req.query.estado;
            if (!estado) throw new Error("Estado não informado");
            let cidades = await MunicipiosModel.aggregate([
                {
                    $match: {
                        "estado.sigla": estado
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        nome: { $first: "$nome" },
                        estado: { $first: "$estado" }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        nome: 1,
                        estado: 1
                    }
                },
                { $sort: { nome: 1 } }
            ])
            res.json(cidades);
        } catch (error) {
            errorHandler(error, res)
        }
    },
}