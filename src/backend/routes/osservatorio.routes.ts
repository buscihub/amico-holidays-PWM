import { Router } from 'express';
import {pendenti} from '../controllers/osservatorio.controller';
import { getDb } from '../db-config';

const router = Router()

router.get('/pendenti', pendenti)