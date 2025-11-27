import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import 'dotenv/config';
import mongoose from 'mongoose';
import { LOTEAMENTO_STATUS, LoteamentosModel } from './models/loteamentos.model';
import { LoteamentosMapasModel } from './models/loteamentos-mapa.model';
import { LOTE_SITUACAO, LotesModel } from './models/lotes.model';
import { createCanvas, loadImage } from 'canvas';
import { storage } from "./integrations/firebase";
import axios from 'axios';
import { delayTimer } from './util';

dayjs.locale('pt-br');

const DB_URL = process.env.DB_URL!;

if (!DB_URL) process.exit(1);

async function atualizarMapasVirtuais() {
    try {
        console.log("Iniciando atualização de mapas virtuais...");
        // Buscar todos os loteamentos ativos que possuem mapa virtual
        const loteamentos = await LoteamentosModel.find({ status: LOTEAMENTO_STATUS.ATIVO, livemap_sync: 0 }).lean();

        for (const loteamento of loteamentos) {
            try {
                console.log(`Processando loteamento: ${loteamento.nome} (${loteamento._id})`);
                const id_loteamento = loteamento._id.toString();

                const mapaVirtual = await LoteamentosMapasModel.findOne({
                    'loteamento._id': id_loteamento
                }).lean();

                if (!mapaVirtual) {
                    continue;
                }

                const lotes = await LotesModel.find({
                    'loteamento._id': id_loteamento
                }).lean();

                let __mapa_url = mapaVirtual.mapa_virtual;
                let __lotes_mapa = [];

                for (let item of mapaVirtual.lotes) {
                    let lote_db = lotes.find((lote: any) =>
                        lote.lote == item.numero && lote.quadra == item.quadra
                    );

                    if (lote_db) {
                        let posX = item.x;
                        let posY = item.y;
                        let width = item.width;
                        let height = item.height;
                        let color = item?.cor || '#CCCCCC';
                        let label = `Q${item.quadra} L${item.numero}`;
                        let situacao = '';

                        if (lote_db.situacao == LOTE_SITUACAO.VENDIDO) {
                            color = '#007bff';
                            situacao = 'Vendido';
                        } else if (lote_db.situacao == LOTE_SITUACAO.RESERVADO) {
                            color = '#ffc107';
                            situacao = 'Reservado';
                        } else if (lote_db.situacao == LOTE_SITUACAO.BLOQUEADO) {
                            color = '#dc3545';
                            situacao = 'Bloqueado';
                        } else if (lote_db.situacao == LOTE_SITUACAO.DISPONIVEL) {
                            color = '#28a745';
                            situacao = 'Disponível';
                        }

                        __lotes_mapa.push({
                            posX,
                            posY,
                            width,
                            height,
                            color,
                            label,
                            situacao
                        });
                    }
                }

                if (!__mapa_url) {
                    continue;
                }

                // Carregar a imagem do mapa
                const imageResponse = await axios.get(__mapa_url, {
                    responseType: 'arraybuffer'
                });
                const imageBuffer = Buffer.from(imageResponse.data);
                const image = await loadImage(imageBuffer);

                // Criar canvas com o tamanho da imagem
                const canvas = createCanvas(image.width, image.height);
                const ctx = canvas.getContext('2d');

                // Desenhar a imagem base
                ctx.drawImage(image, 0, 0);

                // Desenhar os lotes sobre a imagem
                for (let lote of __lotes_mapa) {
                    if (typeof lote.posX !== 'number' || typeof lote.posY !== 'number' ||
                        typeof lote.width !== 'number' || typeof lote.height !== 'number') {
                        continue;
                    }

                    // Desenhar retângulo
                    ctx.fillStyle = lote.color;
                    ctx.globalAlpha = 0.5;
                    ctx.fillRect(lote.posX, lote.posY, lote.width, lote.height);

                    // Desenhar borda
                    ctx.globalAlpha = 1.0;
                    ctx.strokeStyle = lote.color;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(lote.posX, lote.posY, lote.width, lote.height);

                    // Desenhar label
                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(
                        lote.label,
                        lote.posX + lote.width / 2,
                        lote.posY + lote.height / 2
                    );
                }

                // Converter canvas para buffer PNG
                const buffer = canvas.toBuffer('image/png');

                // Upload para o Firebase Storage
                const fileName = `mapas-virtuais/${id_loteamento}.png`;
                const storageFile = storage.file(fileName);

                // Deletar arquivo existente antes de fazer upload
                try {
                    await storageFile.delete();
                } catch (deleteError) {
                    // Ignora erro se arquivo não existir
                }

                await storageFile.save(buffer, {
                    metadata: {
                        contentType: 'image/png',
                        cacheControl: 'public, max-age=60'
                    }
                });
                await storageFile.makePublic();
                const url = storageFile.publicUrl();

                console.log(`Mapa virtual atualizado para loteamento: ${loteamento.nome} (${id_loteamento})`);

                // Atualizar o loteamento com a nova URL e timestamp
                await LoteamentosModel.findByIdAndUpdate(id_loteamento, {
                    $set: {
                        livemap_url: url,
                        livemap_last_update: new Date(),
                        livemap_sync: 1
                    }
                });

            } catch (error: any) {
                console.log(error);
            }
        }
        console.log("Atualização de mapas virtuais concluída.");
    } catch (error) {

        console.error("Erro ao atualizar mapas virtuais:", error);
    }
}

async function start() {
    try {
        await mongoose.connect(DB_URL);
        await atualizarMapasVirtuais();
        await delayTimer(10000);
        process.exit(1);
    } catch (error) {
        console.log('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

start();