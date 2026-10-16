import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/rihousingai',
});

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]) {
  return pool.query<T>(text, params);
}
