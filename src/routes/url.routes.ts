import { Router } from "express";
import {
  shortenUrl,
  redirectUrl,
  updateUrl,
  removeUrl,
} from "../controllers/url.controller";
import { validate } from "../middleware/validate";
import {
  CreateUrlSchema,
  RedirectSchema,
  RemoveUrlSchema,
  UpdateUrlSchema,
} from "../types/url.types";

export const apiRouter = Router();
export const redirectRouter = Router();

// It has to be shorter
redirectRouter.get("/:shortCode", validate(RedirectSchema), redirectUrl);

apiRouter.post("/shorten", validate(CreateUrlSchema), shortenUrl);
apiRouter.put("/:shortCode", validate(UpdateUrlSchema), updateUrl);
apiRouter.delete("/:shortCode", validate(RemoveUrlSchema), removeUrl);
