import { Router } from 'express';
import { autenticar } from '../oauth';
import loteamentosController from '../controllers/loteamentos.controller';

const router = Router();

router.get('/v1/loteamentos', autenticar, loteamentosController.getLoteamentos);
router.get('/v1/loteamento', autenticar, loteamentosController.getLoteamento);
router.post('/v1/loteamentos', autenticar, loteamentosController.setLoteamento);

router.get('/v1/loteamentos/lotes', autenticar, loteamentosController.getLotesPorLoteamento);
router.put('/v1/lotes/situacao', autenticar, loteamentosController.alterarSituacaoLotes);

router.post('/v1/lotes/importar', autenticar, loteamentosController.importarLotes);

router.get('/v1/reservas', autenticar, loteamentosController.getReservas);
router.post('/v1/reservas', autenticar, loteamentosController.setReserva);
router.put('/v1/reservas', autenticar, loteamentosController.updateReserva);
router.get('/v1/reserva', autenticar, loteamentosController.getReserva);



export default router;