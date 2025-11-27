import { Router, Request, Response } from 'express';
import { autenticar } from '../oauth';
import comumController from '../controllers/comum.controller';

const router = Router();

router.get('/', autenticar, (req: Request, res: Response) => {
    res.json({ message: 'API SIS Loteamento 1.0.0' });
});
router.get('/public/estados', comumController.getEstados);
router.get('/public/cidades', comumController.getCidades);
router.get('/public/cep', comumController.getConsultaCEP);
router.get('/public/default-values', comumController.getDefaultValues);
router.get('/public/loteamentos/mapa-virtual/:id_loteamento', comumController.getMapaVirtualLoteamento);

router.get('/v1/admin/configuracoes/formas-pagamento', autenticar, comumController.configuracoes.getFormasPagamento);
router.post('/v1/admin/configuracoes/formas-pagamento', autenticar, comumController.configuracoes.addFormaPagamento);
router.get('/v1/admin/configuracoes/formas-pagamento-disponiveis', autenticar, comumController.configuracoes.getFormasPagamentoDisponiveis);

router.post('/v1/admin/upload', comumController.admin.upload);

router.get('/v1/admin/dashboard/admin', autenticar, comumController.admin.getDashboardAdmin);
router.get('/v1/admin/dashboard/client', comumController.getDashboardClient);

router.get('/v1/admin/dashboard/client/loteamento/:id_loteamento', comumController.getDashboardPorLoteamento);

export default router;