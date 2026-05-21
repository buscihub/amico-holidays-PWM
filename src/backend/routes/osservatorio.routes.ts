import { Router } from 'express';
import {getPendenti} from '../controllers/osservatorio.controller';
import { getDb } from '../db-config';

const router = Router()

router.get('/pendenti', getPendenti)