import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import paymentsRouter from "./payments";
import tournamentsRouter from "./tournaments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(paymentsRouter);
router.use(tournamentsRouter);

export default router;
