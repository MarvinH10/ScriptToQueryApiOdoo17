import axios from 'axios';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const APIOdoo17 = axios.create({
    baseURL: process.env.ODOO_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from
            (`
            ${process.env.ODOO_USERNAME}:
            ${process.env.ODOO_PASSWORD}
            `)
            .toString('base64')}`
    }
});

async function autenticarEnOdoo17() {
    try {
        const response = await APIOdoo17.post('/web/session/authenticate', {
            params: {
                db: process.env.ODOO_BD,
                login: process.env.ODOO_USERNAME,
                password: process.env.ODOO_PASSWORD,
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error al autenticarse con la base de datos de Odoo 17:', error);
        throw error;
    }
}

async function fecthDatosOdoo17(endpoint: string, params?: Record<string, any>): Promise<any> {
    try {
        const response = await APIOdoo17.get(endpoint, { params });
        return response.data;
    } catch (error) {
        console.error(`Error al consumir la API de Odoo 17 en ${endpoint}:`, error);
        throw error;
    }
}

async function processData() {
    try {
        await autenticarEnOdoo17();

        const productos = await fecthDatosOdoo17('/product.product', { limit: 100 }); // POR AHORA PONDREMOS DE LIMITE 100 PROCESOS DE DATOS

        console.log('Datos obtenidos de Odoo 17:', productos);

        // DATOS DEL POSTGRESS SQL
        const client = new Client({
            user: process.env.PG_USER,
            host: process.env.PG_HOST,
            database: process.env.PG_DATABASE,
            password: process.env.PG_PASSWORD,
            port: Number(process.env.PG_PORT),
        });

        await client.connect();
        console.log('Conectado a PostgreSQL');

        for (const producto of productos) {
            const query = `
                INSERT INTO productos (id, name, barcode, price)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                barcode = EXCLUDED.barcode,
                price = EXCLUDED.price;`;

            const values = [
                producto.id,
                producto.name,
                producto.barcode,
                producto.price,
            ];

            await client.query(query, values);
        }

        console.log('Datos insertados/actualizados en la base de datos');
        await client.end();
    } catch (error) {
        console.error('Error procesando datos:', error);
    }
}

processData();
