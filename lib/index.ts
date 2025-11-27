import bodyParser from 'body-parser';
import cors from 'cors';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import 'dotenv/config';
import express from 'express';
import fileUpload from 'express-fileupload';
import mongoose from 'mongoose';
import path from 'path';
import { startDB } from './populations';
import routes from './routes';
import { logDev } from './util';
import { USUARIO_MODEL_TIPO_TELEFONE, USUARIO_NIVEL, UsuariosModel } from './models/usuarios.model';

import bcrypt from 'bcrypt';
import { scopes } from './oauth/permissions';

dayjs.locale('pt-br');

const server = express(),
    PORT = process.env.DEV === "1" ? process.env.DEV_PORT : process.env.PORT,
    DB_URL = process.env.DB_URL!;

if (!DB_URL) process.exit(1);

let static_path = path.join(__dirname, 'public');
server.use(express.static(static_path));

server.use(fileUpload());
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));
server.use(cors());
server.use(detectFetchAndBody);
server.use(resolveHeaders);
server.use(routes);

// const vendedores_json = require("./vendedores.json")

async function start() {
    try {
        await mongoose.connect(DB_URL);
        server.listen(PORT, async () => {
            console.log(`Server is running on port ${PORT}`);
            // startDB();

            // let niveis = [USUARIO_NIVEL.CLIENTE, USUARIO_NIVEL.VENDEDOR];
            // for (let v of vendedores_json) {
            //     let payload: any = {
            //         nome: v.nome,
            //         senha: bcrypt.hashSync('1234', 10),
            //         niveis,
            //         scopes: Object.keys(scopes),
            //         documento: v?.cpf_cnpj || null,
            //         status: "ATIVO",
            //         criado_por: {
            //             data_hora: dayjs().toDate(),
            //             usuario: {
            //                 _id: "SISTEMA",
            //                 nome: "SISTEMA",
            //             }
            //         }
            //     }
            //     if (!!v?.email) payload.email = v.email;
            //     if (v?.telefones?.length > 0) {
            //         payload.telefone_principal = {
            //             tipo: USUARIO_MODEL_TIPO_TELEFONE.CEL_WHATSAPP,
            //             valor: v.telefones[0]
            //         }
            //         payload.telefones = [
            //             {
            //                 tipo: USUARIO_MODEL_TIPO_TELEFONE.CEL_WHATSAPP,
            //                 valor: v.telefones[0],
            //                 principal: true
            //             }
            //         ]
            //     }
            //     if (!payload?.documento) {
            //         console.log("Documento não informado para o vendedor:", v.nome);
            //         continue;
            //     }
            //     // Verifica se o vendedor já existe
            //     let usuario = await UsuariosModel.findOne({ documento: payload.documento });
            //     if (usuario) {
            //         console.log("Vendedor já existe:", payload.documento, "-", payload.nome);
            //         await UsuariosModel.updateOne({ _id: usuario._id }, { status: "ATIVO" });
            //         continue;
            //     }
            //     let doc = new UsuariosModel(payload);
            //     await doc.save();
            //     console.log("Vendedor criado:", payload.documento, "-", payload.nome);
            // }
        });
    } catch (error) {
        console.log('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

start();

function resolveHeaders(req: express.Request, res: express.Response, next: express.NextFunction) {
    console.log(req.method, req.path);
    let userAgent = req.headers["user-agent"];
    if (userAgent?.includes("Google")) {
        return next();
    }
    let payload: any = {
        user_agent: userAgent,
        origin: 'not defined',
        country: req.headers['x-appengine-country'],
        city: req.headers['x-appengine-city'],
        region: req.headers['x-appengine-region'],
        latlng: req.headers['x-appengine-latlng'],
        ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    }
    payload.ip = payload.ip?.replace('::ffff:', '');
    if (!!req?.path) {
        payload['path'] = req.path;
        payload['method'] = req.method.toUpperCase();
    }

    if (payload?.latlng && payload?.latlng != '0.000000,0.000000') {
        payload.location = {
            latitude: payload.latlng.split(",")[0],
            longitude: payload.latlng.split(",")[1],
        }
    }

    let connection_data: any = {};
    for (let item in payload) {
        if (payload[item] != undefined && payload[item] != null) {
            connection_data[item] = payload[item];
        }
    }
    if (payload.origin == 'not defined' && req.headers['origin']) {
        connection_data.origin = req.headers['origin'];
    }
    // if (process.env.DEV === "1") {
    //     console.log('Connection Data:', connection_data);
    // }
    req.connection_data = connection_data;
    next();
}

function printRoutes() {
    let rotas: any[] = [];
    routes.stack.forEach((route: any) => {
        let stack: any[] = route.handle.stack;
        stack.forEach((r) => {
            rotas.push({
                method: Object.keys(r.route.methods)[0].toUpperCase(),
                path: r.route.path,
            })
        })
    });
    let _rotas = rotas.map((r) => `${r.method} ${r.path}`).join("\n");
}
function detectFetchAndBody(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.headers['content-type'] === 'application/json' && (req.method === 'POST' || req.method == 'PUT')) {
        const body = req.body;
        if (body && typeof body === 'object') {
            const fetchBody = JSON.stringify(body, null, 2);
            // logDev(fetchBody);
            const requestSizeInMB = Buffer.byteLength(fetchBody, 'utf8') / (1024 * 1024);
            // logDev('Request size in MB:', requestSizeInMB.toFixed(2));
        }
    }
    next();
}