import {Router} from 'express';
import { shortenUrl, redirectUrl } from '../controllers/url.controller';
import { validate } from '../middleware/validate';
import { CreateUrlSchema, RedirectSchema } from '../types/url.types';

const router = Router();

router.post('/shorten', validate(CreateUrlSchema), shortenUrl);
router.get('/:shortCode', validate(RedirectSchema), redirectUrl);

export default router;