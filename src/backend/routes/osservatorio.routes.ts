import { Router } from 'express';
import {getPendenti} from '../controllers/osservatorio.controllers';
import { getDb } from '../db-config';

const router = Router()

router.get('/pendenti', getPendenti)