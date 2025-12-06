import * as fs from 'node:fs';
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL?.replace('localhost', '127.0.0.1'),
});

async function test() {
  try {
    console.log('Connecting to:', process.env.DATABASE_URL);
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Time:', res.rows[0]);
    await client.end();
  } catch (err) {
    const error = err as Error;
    const errorMsg = `Connection failed: ${error.message}\nStack: ${error.stack}`;
    console.error(errorMsg);
    fs.writeFileSync('db-test.log', errorMsg);
    process.exit(1);
  }
}

test();
