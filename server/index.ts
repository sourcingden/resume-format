import express from 'express';
import cors from 'cors';
import { cdrRouter } from './cdrConverter';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.use('/api', cdrRouter);

app.listen(PORT, () => {
  console.log(`[CDR Server] Listening on http://localhost:${PORT}`);
});
