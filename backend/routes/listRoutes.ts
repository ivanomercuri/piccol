import express from 'express';

const router = express.Router();

// listRoutesController.ts esporta con `export = { listRoutes: ... }` (un
// singolo oggetto, non export con nome): va importato come default e
// destrutturato — stesso pattern usato per `import models from '../../models'`
// in Fase 2.5.
import listRoutesController from '../controllers/listRoutesController';

const { listRoutes } = listRoutesController;

router.get('/routes', listRoutes);

export = router;