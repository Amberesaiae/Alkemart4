import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import cartRouter from "./cart";
import authRouter from "./auth";
import vendorRouter from "./vendor";
import homepageRouter from "./homepage";
import adminRouter from "./admin";
import conversationsRouter from "./conversations";
import imagesRouter from "./images";
import ordersRouter from "./orders";
import promotionsRouter from "./promotions";
import notificationsRouter from "./notifications";
import addressesRouter from "./addresses";
import disputesRouter from "./disputes";
import settlementsRouter from "./settlements";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(cartRouter);
router.use(authRouter);
router.use(vendorRouter);
router.use(homepageRouter);
router.use(adminRouter);
router.use(conversationsRouter);
router.use(imagesRouter);
router.use(ordersRouter);
router.use(promotionsRouter);
router.use(notificationsRouter);
router.use(addressesRouter);
router.use(disputesRouter);
router.use(settlementsRouter);

export default router;
