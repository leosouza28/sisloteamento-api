import { Router } from 'express';
import usuariosRoutes from './usuarios.routes';
import comumRoutes from './comum.routes';
import relatoriosRoutes from './relatorios.routes';
import loteamentosRoutes from './loteamentos.routes';

const router = Router();

router.use(comumRoutes);
router.use(loteamentosRoutes);
router.use(usuariosRoutes);
router.use(relatoriosRoutes);

export default router;