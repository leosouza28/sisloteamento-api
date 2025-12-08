import dayjs from "dayjs";
import { NextFunction, Request, Response } from "express";
import { LoteamentosMapasModel } from "../models/loteamentos-mapa.model";
import { LoteamentosModel } from "../models/loteamentos.model";
import { LOTE_SITUACAO, LotesModel } from "../models/lotes.model";
import { RESERVA_SITUACAO, ReservasModel } from "../models/reservas.model";
import { UsuariosModel } from "../models/usuarios.model";
import { UNAUTH_SCOPE } from "../oauth";
import { isScopeAuthorized } from "../oauth/permissions";
import { errorHandler } from "../util";

export default {

    getLoteamentosDisponiveis: async (req: Request, res: Response, next: NextFunction) => {
        try {
            let lista = await LoteamentosModel.find({}).lean();
            let total = lista.length;
            res.json({ lista, total });
        } catch (error) {
            errorHandler(error, res);
        }
    },
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

            for (let l of lista) {
                let mapa_virtual = await LoteamentosMapasModel.findOne({ 'loteamento._id': l._id.toString() }).lean();
                if (mapa_virtual) {
                    l.mapa_virtual = {
                        _id: mapa_virtual._id,
                        mapa_virtual: mapa_virtual.mapa_virtual,
                        lotes: mapa_virtual.lotes,
                    }
                }
            }

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
            let mapa_virtual = await LoteamentosMapasModel.findOne({ 'loteamento._id': loteamento._id.toString() }).lean();
            if (mapa_virtual) {
                loteamento.mapa_virtual = {
                    // @ts-ignore
                    _id: mapa_virtual._id,
                    mapa_virtual: mapa_virtual.mapa_virtual,
                    lotes: mapa_virtual.lotes,
                }
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
    alterarSituacaoLotes: async (req: Request, res: Response, next: NextFunction) => {
        try {
            // @ts-ignore
            if (!isScopeAuthorized('loteamentos.editar', req.usuario?.scopes)) {
                throw UNAUTH_SCOPE
            }
            const { lote_ids, situacao } = req.body;
            if (!lote_ids || !Array.isArray(lote_ids) || lote_ids.length === 0) {
                throw new Error("IDs dos lotes não informados.");
            }
            if (!situacao) {
                throw new Error("Situação não informada.");
            }
            const situacoesValidas = [LOTE_SITUACAO.DISPONIVEL, LOTE_SITUACAO.BLOQUEADO];
            if (!situacoesValidas.includes(situacao)) {
                throw new Error("Situação inválida.");
            }

            // VErifica se todos os lotes existem
            const lotesExistentes = await LotesModel.find({ _id: { $in: lote_ids } }).lean();
            if (lotesExistentes.length !== lote_ids.length) {
                throw new Error("Um ou mais lotes não foram encontrados.");
            }
            // Depois verifica se nenhum deles está RESERVADO ou VENDIDO
            const lotesInvalidos = lotesExistentes.filter(lote =>
                lote.situacao === LOTE_SITUACAO.RESERVADO || lote.situacao === LOTE_SITUACAO.VENDIDO
            );
            if (lotesInvalidos.length > 0) {
                throw new Error("Um ou mais lotes estão reservados ou vendidos e não podem ser alterados.");
            }
            // Atualiza os lotes
            const resultado = await LotesModel.updateMany(
                { _id: { $in: lote_ids } },
                {
                    $set: {
                        situacao: situacao
                    }
                }
            );

            let loteamento = lotesExistentes.length ? lotesExistentes[0].loteamento : null;
            if (loteamento && loteamento._id) resetSyncLoteamentosLivemap(loteamento._id).then();
            res.json({
                success: true,
                message: `${resultado.modifiedCount} lote(s) atualizado(s) com sucesso.`,
                modificados: resultado.modifiedCount
            });
        } catch (error) {
            errorHandler(error, res);
        }
    },
    saveMapaVirtualLoteamento: async (req: Request, res: Response, next: NextFunction) => {
        try {
            console.log(req.body);
            let { loteamento_id, imagem_url, lotes } = req.body;
            let loteamento = await LoteamentosModel.findById(loteamento_id);
            if (!loteamento) {
                throw new Error("Loteamento não encontrado.");
            }
            await LoteamentosMapasModel.updateOne(
                {
                    'loteamento._id': loteamento._id,
                },
                {
                    $set: {
                        loteamento: loteamento,
                        mapa_virtual: imagem_url,
                        lotes
                    }
                },
                { upsert: true }
            );
            res.json({ message: "Mapa virtual atualizado com sucesso." });
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
            let keys_situacao = {
                'D': LOTE_SITUACAO.DISPONIVEL,
                'R': LOTE_SITUACAO.RESERVADO,
                'B': LOTE_SITUACAO.BLOQUEADO,
                'V': LOTE_SITUACAO.VENDIDO,
            }
            // Esconder todos os lotes existentes para este loteamento
            await LotesModel.updateMany(
                { 'loteamento._id': loteamento._id },
                {
                    $unset: {
                        reserva: ""
                    },
                    $set: {
                        exibivel: false
                    }
                }
            );
            let quantidade_quadras = 0;
            let quantidade_lotes = 0;
            let valor_total_lotes = 0;
            let _quadras: any = {};
            for (let i of req.body.lotes) {
                _quadras[i.quadra] = true;
            }
            quantidade_quadras = Object.keys(_quadras).length;
            let lotes_diferenca: string[] = [];
            let upserts = req.body.lotes.map(async (lote: any) => {
                let quadraPad3 = lote.quadra.padStart(3, '0');
                let lotePad3 = lote.lote.padStart(3, '0');
                let loteamento_quadra_lote = `${loteamento.slug}-Q${quadraPad3}-L${lotePad3}`.toUpperCase();
                let _lote = await LotesModel.findOne({ loteamento_quadra_lote }).lean();
                // @ts-ignore
                let situacao_csv = keys_situacao[lote.situacao] || LOTE_SITUACAO.DISPONIVEL;
                let payload = {
                    loteamento_quadra_lote,
                    loteamento: {
                        _id: loteamento._id,
                        nome: loteamento.nome,
                    },
                    quadra: quadraPad3,
                    lote: lotePad3,
                    area: lote.area,
                    situacao: situacao_csv,
                    valor_area: lote.valor_area,
                    valor_total: lote.valor_total,
                    valor_entrada: lote.entrada || 0,
                    exibivel: true,
                    situacao_sistema: undefined,
                    situacao_csv: situacao_csv,
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
            // Verificar todas as reservas e atualizar situação dos lotes vinculados
            let reservas = await ReservasModel.find({
                'loteamento._id': loteamento._id,
                'situacao': {
                    $in: [
                        RESERVA_SITUACAO.ATIVA,
                        RESERVA_SITUACAO.CONCLUIDA
                    ]
                }
            }).lean();
            for (let reserva of reservas) {
                let loteUpdates = reserva.lotes.map(lote => {
                    return LotesModel.updateOne(
                        { loteamento_quadra_lote: lote.loteamento_quadra_lote },
                        {
                            $set: {
                                reserva: reserva,
                                situacao: reserva.situacao === RESERVA_SITUACAO.CONCLUIDA ? LOTE_SITUACAO.VENDIDO : LOTE_SITUACAO.RESERVADO
                            }
                        }
                    );
                });
                await Promise.all(loteUpdates);
            }
            resetSyncLoteamentosLivemap(loteamento._id.toString()).then()
            res.json({ message: `Lotes importados com sucesso. ${lotes_diferenca.length ? 'Lotes com diferença de situação: ' + lotes_diferenca.join(', ') : ''}` });
        } catch (error) {
            errorHandler(error, res);
        }
    },
    getReserva: async (req: Request, res: Response, next: NextFunction) => {
        try {
            // @ts-ignore
            if (!isScopeAuthorized('reservas.leitura', req.usuario?.scopes)) {
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
            if (!isScopeAuthorized('reservas.leitura', req.usuario?.scopes)) {
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

            if (query?.situacao == 'ATIVA') {
                find.situacao = { $in: [RESERVA_SITUACAO.ATIVA] };
            }
            if (query?.situacao == 'CONCLUIDA') {
                find.situacao = { $in: [RESERVA_SITUACAO.CONCLUIDA] };
            }
            if (query?.situacao == 'CANCELADA') {
                find.situacao = { $in: [RESERVA_SITUACAO.CANCELADA] };
            }
            if (query?.situacao == 'ATIVA_CONCLUIDA') {
                find.situacao = { $in: [RESERVA_SITUACAO.ATIVA, RESERVA_SITUACAO.CONCLUIDA] };
            }
            if (query?.vendedorId) {
                find['vendedor._id'] = query.vendedorId
            }
            if (!!query?.dataInicial && !!query?.dataFinal) {
                find['data_reserva'] = {
                    $gte: dayjs(query.dataInicial as string).toDate(),
                    $lte: dayjs(query.dataFinal as string).toDate()
                }
            }
            if (!!query?.loteamentoId) {
                find['loteamento._id'] = query.loteamentoId
            }

            total = await ReservasModel.find(find).countDocuments();
            lista = await ReservasModel.find(find)
                .skip(skip)
                .limit(limit)
                .sort({ data_reserva: 1 })
                .lean();

            res.json({ lista, total })
        } catch (error) {
            errorHandler(error, res);
        }
    },
    updateReserva: async (req: Request, res: Response, next: NextFunction) => {
        try {
            // @ts-ignore
            if (!isScopeAuthorized('reservas.editar', req.usuario?.scopes)) {
                throw UNAUTH_SCOPE
            }

            if (req.body.operacao == 'cancelar-reserva') {
                let _reserva = await ReservasModel.findById(req.body.reserva_id);
                if (!_reserva) {
                    throw new Error("Reserva não encontrada.");
                }
                _reserva.atualizado_por = {
                    data_hora: dayjs().toDate(),
                    // @ts-ignore
                    usuario: req.usuario
                };
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
                        {
                            $set: {
                                situacao: 'DISPONIVEL'
                            },
                            $unset: {
                                reserva: ""
                            }
                        }
                    );
                });
                await Promise.all(loteUpdates);
                if (!!_reserva.loteamento?._id) resetSyncLoteamentosLivemap(_reserva.loteamento._id).then();
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
                await ReservasModel.findOneAndUpdate(
                    { _id: _reserva._id },
                    {
                        $set: {
                            vendedor: _vendedor,
                            atualizado_por: {
                                data_hora: dayjs().toDate(),
                                // @ts-ignore
                                usuario: req.usuario
                            }
                        }
                    },
                    {
                        new: true
                    }
                );
                // Alterar reserva dentro do lote:
                let loteUpdates = _reserva.lotes.map(lote => {
                    return LotesModel.updateOne(
                        { loteamento_quadra_lote: lote.loteamento_quadra_lote },
                        { $set: { reserva: _reserva } }
                    );
                });
                await Promise.all(loteUpdates);
                if (!!_reserva.loteamento?._id) resetSyncLoteamentosLivemap(_reserva.loteamento._id).then();
                res.json({ message: "Vendedor da reserva alterado com sucesso." });
                return;
            }
            else if (req.body.operacao == 'alterar-lote-situacao') {

                let _reserva = await ReservasModel.findById(req.body.reserva_id);
                if (!_reserva) {
                    throw new Error("Reserva não encontrada.");
                }
                _reserva.atualizado_por = {
                    data_hora: dayjs().toDate(),
                    // @ts-ignore
                    usuario: req.usuario
                };

                let _lote = await LotesModel.findOne({ loteamento_quadra_lote: req.body.lote_id });
                if (!_lote) {
                    throw new Error("Lote não encontrado.");
                }
                // Verifica se o lote faz parte da reserva
                let loteNaReserva = _reserva.lotes.find(l => l.loteamento_quadra_lote === req.body.lote_id);
                if (!loteNaReserva) {
                    throw new Error("Lote não faz parte desta reserva.");
                }
                // Atualiza a situação do lote
                _lote.situacao = req.body.nova_situacao;
                await _lote.save();

                // Verifica todos os lotes da reserva estão vendidos
                let allLotes = await LotesModel.find({ loteamento_quadra_lote: { $in: _reserva.lotes.map(l => l.loteamento_quadra_lote) } }).lean();
                let allVendido = allLotes.every(l => l.situacao === 'VENDIDO');
                if (allVendido) {
                    _reserva.situacao = RESERVA_SITUACAO.CONCLUIDA;
                    await _reserva.save();
                } else {
                    // Se não, e a reserva estava concluída, volta para ativa
                    if (_reserva.situacao === RESERVA_SITUACAO.CONCLUIDA) {
                        _reserva.situacao = RESERVA_SITUACAO.ATIVA;
                        await _reserva.save();
                    }
                }
                if (!!_reserva.loteamento?._id) resetSyncLoteamentosLivemap(_reserva.loteamento._id).then();
                res.json({ message: "Situação do lote alterada com sucesso." });
                return;
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
            // @ts-ignore
            if (!isScopeAuthorized('reservas.editar', req.usuario?.scopes)) {
                throw UNAUTH_SCOPE
            }

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
                data_reserva: dayjs(req.body.data_reserva).toDate(),
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
                    {
                        $set: {
                            situacao: 'RESERVADO',
                            reserva: reserva
                        }
                    }
                );
            });
            await Promise.all(loteUpdates);
            resetSyncLoteamentosLivemap(_loteamento._id.toString()).then();
            res.json(reserva);
        } catch (error) {
            errorHandler(error, res);
        }
    }
}


export async function resetSyncLoteamentosLivemap(loteamentoId: string) {
    await LoteamentosModel.updateOne(
        { _id: loteamentoId },
        {
            $set: {
                livemap_sync: 0
            }
        }
    );
}