import { NextFunction, Request, Response } from "express";
import { errorHandler } from "../util";
import { UNAUTH_SCOPE } from "../oauth";
import { LoteamentosModel } from "../models/loteamentos.model";
import { isScopeAuthorized } from "../oauth/permissions";
import { LOTE_SITUACAO, LotesModel } from "../models/lotes.model";
import { RESERVA_SITUACAO, ReservasModel } from "../models/reservas.model";
import dayjs from "dayjs";
import { UsuariosModel } from "../models/usuarios.model";

export default {

    getLoteamentos: async (req: Request, res: Response, next: NextFunction) => {
        try {
            let { perpage, page, ...query } = req.query
            // @ts-ignore
            if (!isScopeAuthorized('loteamentos.leitura', req.usuario?.scopes)) {
                throw UNAUTH_SCOPE
            }
            let busca = req.query?.q || "";
            let lista: any = [], total = 0,
                porpagina = 10, pagina = 0, skip = 0, limit = 0;

            if (perpage && page) {
                porpagina = Number(perpage);
                pagina = Number(page);
                pagina--
                skip = porpagina * pagina;
                limit = porpagina;
            }

            let find: any = {
                $or: [
                    { nome: { $regex: busca, $options: 'i' } },
                ]
            }

            total = await LoteamentosModel.find(find).countDocuments();
            lista = await LoteamentosModel.find(find)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .lean();

            res.json({ lista, total })
        } catch (error) {
            errorHandler(error, res);
        }
    },
    getLoteamento: async (req: Request, res: Response, next: NextFunction) => {
        try {
            // @ts-ignore
            if (!isScopeAuthorized('loteamentos.leitura', req.usuario?.scopes)) {
                throw UNAUTH_SCOPE
            }
            let loteamento = await LoteamentosModel.findById(req.query.id).lean();
            if (!loteamento) {
                throw new Error("Loteamento não encontrado.");
            }
            res.json(loteamento);
        } catch (error) {
            errorHandler(error, res);
        }
    },
    setLoteamento: async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!!req.body?._id) {
                // Edição
                // @ts-ignore
                if (!isScopeAuthorized('loteamentos.editar', req.usuario?.scopes)) {
                    throw UNAUTH_SCOPE
                }
                let loteamento = await LoteamentosModel.findById(req.body._id);
                if (!loteamento) {
                    throw new Error("Loteamento não encontrado.");
                }
                // Verifica se o slug ja existe para outro loteamento
                let existing = await LoteamentosModel.findOne({ slug: req.body.slug, _id: { $ne: req.body._id } });
                if (existing) {
                    throw new Error("Slug já existe para outro loteamento.");
                }
                loteamento.slug = req.body.slug;
                loteamento.nome = req.body.nome;
                loteamento.descricao = req.body.descricao;
                loteamento.cidade = req.body.cidade;
                loteamento.estado = req.body.estado;
                loteamento.mapa_empreendimento = req.body?.mapa_empreendimento || '';
                loteamento.alterado_por = {
                    data_hora: new Date(),
                    // @ts-ignore
                    usuario: req.usuario
                };
                await loteamento.save();
                res.json({ message: "Loteamento atualizado com sucesso." });
                return;
            } else {
                // Verifica se o slug ja existe
                let existing = await LoteamentosModel.findOne({ slug: req.body.slug });
                if (existing) {
                    throw new Error("Slug já existe para outro loteamento.");
                }
                let newLoteamento = new LoteamentosModel({
                    slug: req.body.slug,
                    nome: req.body.nome,
                    descricao: req.body.descricao,
                    cidade: req.body.cidade,
                    estado: req.body.estado,
                    mapa_empreendimento: req.body?.mapa_empreendimento || '',
                    criado_por: {
                        data_hora: new Date(),
                        // @ts-ignore
                        usuario: req.usuario
                    }
                });
                await newLoteamento.save();
                res.json({ message: "Loteamento criado com sucesso.", _id: newLoteamento._id });
                return;
            }

        } catch (error) {
            errorHandler(error, res);
        }
    },
    getLotesPorLoteamento: async (req: Request, res: Response, next: NextFunction) => {
        try {
            // @ts-ignore
            if (!isScopeAuthorized('loteamentos.leitura', req.usuario?.scopes)) {
                throw UNAUTH_SCOPE
            }
            let loteamento = await LoteamentosModel.findById(req.query.loteamento_id);
            if (!loteamento) {
                throw new Error("Loteamento não encontrado.");
            }
            let lotes = await LotesModel.find({ 'loteamento._id': loteamento._id, exibivel: true }).lean();
            res.json(lotes);
        } catch (error) {
            errorHandler(error, res);
        }
    },
    importarLotes: async (req: Request, res: Response, next: NextFunction) => {
        try {
            let loteamento = await LoteamentosModel.findById(req.body.loteamento_id);
            if (!loteamento) {
                throw new Error("Loteamento não encontrado.");
            }

            // Esconder todos os lotes existentes para este loteamento
            await LotesModel.updateMany(
                { 'loteamento._id': loteamento._id },
                { $set: { exibivel: false } }
            );
            let quantidade_quadras = 0;
            let quantidade_lotes = 0;
            let valor_total_lotes = 0;
            let _quadras: any = {};
            for (let i of req.body.lotes) {
                _quadras[i.quadra] = true;
            }
            quantidade_quadras = Object.keys(_quadras).length;
            let upserts = req.body.lotes.map(async (lote: any) => {
                let quadraPad3 = lote.quadra.padStart(3, '0');
                let lotePad3 = lote.lote.padStart(3, '0');
                let loteamento_quadra_lote = `${loteamento.slug}-Q${quadraPad3}-L${lotePad3}`.toUpperCase();
                let _lote = await LotesModel.findOne({ loteamento_quadra_lote }).lean();
                let payload = {
                    loteamento_quadra_lote,
                    loteamento: {
                        _id: loteamento._id,
                        nome: loteamento.nome,
                    },
                    quadra: quadraPad3,
                    lote: lotePad3,
                    area: lote.area,
                    valor_area: lote.valor_area,
                    valor_total: lote.valor_total,
                    situacao: _lote?.situacao || LOTE_SITUACAO.DISPONIVEL,
                    valor_entrada: lote.entrada || 0,
                    exibivel: true,
                }
                quantidade_lotes += 1;
                valor_total_lotes += lote.valor_total;
                return LotesModel.updateOne(
                    { loteamento_quadra_lote },
                    { $set: { ...payload } },
                    { upsert: true }
                )
            });
            await Promise.all(upserts);
            await LoteamentosModel.updateOne(
                { _id: loteamento._id },
                {
                    $set: {
                        quantidade_quadras,
                        quantidade_lotes,
                        valor_total_lotes,
                    }
                }
            );
            res.json({ message: "Lotes importados com sucesso." });
        } catch (error) {
            errorHandler(error, res);
        }
    },
    getReserva: async (req: Request, res: Response, next: NextFunction) => {
        try {
            // @ts-ignore
            if (!isScopeAuthorized('loteamentos.leitura', req.usuario?.scopes)) {
                throw UNAUTH_SCOPE
            }
            let reserva = await ReservasModel.findById(req.query.id).lean();
            if (!reserva) {
                throw new Error("Reserva não encontrada.");
            }
            let _lotes = await LotesModel.find({ 'loteamento._id': reserva.loteamento?._id }).lean();
            let lotesComSituacao = reserva.lotes.map(loteReserva => {
                let loteDetalhe = _lotes.find(l => l.loteamento_quadra_lote === loteReserva.loteamento_quadra_lote);
                return {
                    ...loteReserva,
                    situacao: loteDetalhe?.situacao,
                }
            });
            res.json({ ...reserva, lotes: lotesComSituacao });
        } catch (error) {
            errorHandler(error, res);
        }
    },
    getReservas: async (req: Request, res: Response, next: NextFunction) => {
        try {
            let { perpage, page, ...query } = req.query
            // @ts-ignore
            if (!isScopeAuthorized('loteamentos.leitura', req.usuario?.scopes)) {
                throw UNAUTH_SCOPE
            }
            let busca = req.query?.q || "";
            let lista: any = [], total = 0,
                porpagina = 10, pagina = 0, skip = 0, limit = 0;

            if (perpage && page) {
                porpagina = Number(perpage);
                pagina = Number(page);
                pagina--
                skip = porpagina * pagina;
                limit = porpagina;
            }

            let find: any = {
                $or: [
                    { 'codigo_reserva': { $regex: busca, $options: 'i' } },
                    { 'cliente.nome': { $regex: busca, $options: 'i' } },
                ]
            }

            total = await ReservasModel.find(find).countDocuments();
            lista = await ReservasModel.find(find)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .lean();

            res.json({ lista, total })
        } catch (error) {
            errorHandler(error, res);
        }
    },
    updateReserva: async (req: Request, res: Response, next: NextFunction) => {
        try {
            console.log(req.body);

            if (req.body.operacao == 'cancelar-reserva') {
                let _reserva = await ReservasModel.findById(req.body.reserva_id);
                if (!_reserva) {
                    throw new Error("Reserva não encontrada.");
                }
                if (_reserva.situacao === RESERVA_SITUACAO.CANCELADA) {
                    throw new Error("Reserva já está cancelada.");
                }
                // Atualiza situação da reserva
                _reserva.situacao = RESERVA_SITUACAO.CANCELADA;
                await _reserva.save();
                // Libera os lotes reservados
                let loteUpdates = _reserva.lotes.map(lote => {
                    return LotesModel.updateOne(
                        { loteamento_quadra_lote: lote.loteamento_quadra_lote },
                        { $set: { situacao: 'DISPONIVEL' } }
                    );
                });
                await Promise.all(loteUpdates);
                res.json({ message: "Reserva cancelada e lotes liberados com sucesso." });
                return;
            }
            else if (req.body.operacao == 'alterar-vendedor') {
                let _reserva = await ReservasModel.findById(req.body.reserva_id);
                if (!_reserva) {
                    throw new Error("Reserva não encontrada.");
                }
                let _vendedor = await UsuariosModel.findOne({ _id: req.body.novo_vendedor }).lean();
                if (!_vendedor) {
                    throw new Error("Vendedor não encontrado.");
                }
                await ReservasModel.updateOne(
                    { _id: _reserva._id },
                    { $set: { vendedor: _vendedor } }
                );
                res.json({ message: "Vendedor da reserva alterado com sucesso." });
                return;
            }
            else if (req.body.operacao == 'alterar-lote-situacao') {
            }
            else {
                throw new Error("Operação não reconhecida.");
            }


        } catch (error) {
            errorHandler(error, res);
        }
    },
    setReserva: async (req: Request, res: Response, next: NextFunction) => {
        try {
            let _loteamento = await LoteamentosModel.findOne({ _id: req.body.loteamento_id });
            if (!_loteamento) {
                throw new Error("Loteamento não encontrado.");
            }
            let _lotes = await LotesModel.find({ _id: { $in: req.body.lotes_ids } });
            if (_lotes.length !== req.body.lotes_ids.length) {
                throw new Error("Um ou mais lotes não encontrados.");
            }
            let qtd_lotes = 0;
            let valor_total = 0;
            // Verifica se algum dos lotes já está reservado ou vendido
            for (let lote of _lotes) {
                if (lote.situacao === 'RESERVADO' || lote.situacao === 'VENDIDO') {
                    throw new Error(`O lote ${lote.loteamento_quadra_lote} já está ${lote.situacao.toLowerCase()}.`);
                }
                qtd_lotes += 1;
                valor_total += lote?.valor_total || 0;
            }
            let _cliente = await UsuariosModel.findOne({ _id: req.body.cliente_id }).lean();
            if (!_cliente) {
                throw new Error("Cliente não encontrado.");
            }

            if (req.body.vendedor_id == null) {
                throw new Error("Vendedor não informado.");
            }
            let _vendedor = await UsuariosModel.findOne({ _id: req.body.vendedor_id }).lean();
            if (!_vendedor) {
                throw new Error("Vendedor não encontrado.");
            }
            let cod = await ReservasModel.countDocuments();
            let codigo_reserva = `RES-${(cod + 1).toString().padStart(6, '0')}`;
            let reserva = new ReservasModel({
                codigo_reserva,
                loteamento: _loteamento,
                lotes: _lotes.map(lote => ({
                    loteamento_quadra_lote: lote.loteamento_quadra_lote,
                    quadra: lote.quadra,
                    lote: lote.lote,
                    area: lote.area,
                    valor_area: lote.valor_area,
                    valor_total: lote.valor_total,
                    valor_entrada: lote.valor_entrada,
                })),
                vendedor: _vendedor,
                cliente: _cliente,
                criado_por: {
                    data_hora: dayjs().toDate(),
                    // @ts-ignore
                    usuario: req.usuario
                },
                situacao: RESERVA_SITUACAO.ATIVA
            });
            await reserva.save();
            // Marcar lotes como RESERVADOS
            let loteUpdates = _lotes.map(lote => {
                return LotesModel.updateOne(
                    { _id: lote._id },
                    { $set: { situacao: 'RESERVADO' } }
                );
            });
            await Promise.all(loteUpdates);
            res.json(reserva);
        } catch (error) {
            errorHandler(error, res);
        }
    }
}


