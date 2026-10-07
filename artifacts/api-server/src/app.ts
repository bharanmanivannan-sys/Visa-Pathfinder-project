import express, { type Express } from "express";
import cors from "cors";
import crypto from "node:crypto";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const sessionSecret =
  process.env.SESSION_SECRET ?? "local-development-session-secret";

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser(sessionSecret));
app.use((req, res, next) => {
  if (typeof req.signedCookies?.visa_workspace !== "string") {
    res.cookie("visa_workspace", crypto.randomUUID(), {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      signed: true,
    });
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
