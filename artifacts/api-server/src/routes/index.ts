import { Router, type IRouter } from "express";
import healthRouter from "./health";
import guidanceRouter from "./guidance";
import alertsRouter from "./alerts";
import jobMarketRouter from "./job-market";
import plansRouter from "./plans";
import visaResourcesRouter from "./visa-resources";

const router: IRouter = Router();
router.use(healthRouter);
router.use(guidanceRouter);
router.use(alertsRouter);
router.use(jobMarketRouter);
router.use(plansRouter);
router.use(visaResourcesRouter);

export default router;
