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

const router = Router();

router.post("/shorten", validate(CreateUrlSchema), shortenUrl);
router.get("/:shortCode", validate(RedirectSchema), redirectUrl);
router.put("/:shortCode", validate(UpdateUrlSchema), updateUrl);
router.delete("/:shortCode", validate(RemoveUrlSchema), removeUrl);

export default router;
