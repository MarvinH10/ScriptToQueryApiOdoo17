const xmlrpc = require('xmlrpc');
const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const ODOO_URL = process.env.ODOO_URL;
const ODOO_BD = process.env.ODOO_BD;
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

const common = xmlrpc.createClient({
    url: `${ODOO_URL}/xmlrpc/2/common`,
    headers: {
        'Content-Type': 'text/xml',
    },
});

const object = xmlrpc.createClient({
    url: `${ODOO_URL}/xmlrpc/2/object`,
    headers: {
        'Content-Type': 'text/xml',
    },
});

async function autenticarEnOdoo() {
    return new Promise((resolve, reject) => {
        common.methodCall(
            'authenticate',
            [ODOO_BD, ODOO_USERNAME, ODOO_PASSWORD, {}],
            (error, uid) => {
                if (error) {
                    // console.error('Error al autenticar en Odoo:', error);
                    reject(error);
                } else {
                    // console.log('Autenticación exitosa en Odoo. UID:', uid);
                    resolve(uid);
                }
            }
        );
    });
}

async function fetchDatosOdoo(uid, model, domain, fields) {
    return new Promise((resolve, reject) => {
        object.methodCall(
            'execute_kw',
            [ODOO_BD, uid, ODOO_PASSWORD, model, 'search_read', [domain], { fields }],
            (error, result) => {
                if (error) {
                    console.error(`Error al consultar el modelo ${model}:`, error);
                    reject(error);
                } else {
                    console.log(`Datos obtenidos del modelo ${model}:`, JSON.stringify(result, null, 2));
                    resolve(result);
                }
            }
        );
    });
}

(async () => {
    try {
        const uid = await autenticarEnOdoo();
        if (!uid) {
            console.error('No se pudo autenticar en Odoo.');
            return;
        }
        const campos = [
            'id',
            'sequence_prefix',
            'sequence_number',
            'invoice_date',
            'create_date',
            'invoice_date_due',
            'l10n_pe_edi_operation_type',
            'currency_id',
            'amount_untaxed',
            'amount_tax',
            'amount_total',
        ];
        const dominio = [];
        await fetchDatosOdoo(uid, 'account.move', dominio, campos);
        // console.log('Registros obtenidos:', JSON.stringify(registros, null, 2));
    } catch (error) {
        console.error('Error durante la ejecución:', error);
    }
})();

async function processData() {
    try {
        const uid = await autenticarEnOdoo();
        if (!uid) {
            console.error('No se pudo autenticar en Odoo.');
            return;
        }

        const campos = [
            'id',
            'sequence_prefix',
            'sequence_number',
            'invoice_date',
            'create_date',
            'invoice_date_due',
            'l10n_pe_edi_operation_type',
            'currency_id',
            'amount_untaxed',
            'amount_tax',
            'amount_total',
        ];

        const dominio = [];

        const datos = await fetchDatosOdoo(uid, 'account.move', dominio, campos);
        console.log('Datos obtenidos de Odoo:', datos);

        const client = new Client({
            user: process.env.PG_USER,
            host: process.env.PG_HOST,
            database: process.env.PG_DATABASE,
            password: process.env.PG_PASSWORD,
            port: Number(process.env.PG_PORT),
        });

        await client.connect();
        console.log('Conectado a PostgreSQL');

        for (const dato of datos) {
            const query = `
                INSERT INTO account_moves (
                    id,
                    sequence_prefix,
                    sequence_number,
                    invoice_date,
                    create_date,
                    invoice_date_due,
                    operation_type,
                    currency_id,
                    amount_untaxed,
                    amount_tax,
                    amount_total
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (id) DO UPDATE SET
                    sequence_prefix = EXCLUDED.sequence_prefix,
                    sequence_number = EXCLUDED.sequence_number,
                    invoice_date = EXCLUDED.invoice_date,
                    create_date = EXCLUDED.create_date,
                    invoice_date_due = EXCLUDED.invoice_date_due,
                    operation_type = EXCLUDED.operation_type,
                    currency_id = EXCLUDED.currency_id,
                    amount_untaxed = EXCLUDED.amount_untaxed,
                    amount_tax = EXCLUDED.amount_tax,
                    amount_total = EXCLUDED.amount_total;
            `;

            const values = [
                dato.id,
                dato.sequence_prefix,
                dato.sequence_number,
                dato.invoice_date ? dato.invoice_date : null,
                dato.create_date ? dato.create_date : null,
                dato.invoice_date_due ? dato.invoice_date_due : null,
                dato.l10n_pe_edi_operation_type,
                dato.currency_id[0],
                dato.amount_untaxed,
                dato.amount_tax,
                dato.amount_total,
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

async function main() {
    try {
        console.log("Inicio de ejecución del script...");
        await processData();
        console.log("Ejecución completada. Esperando 24 horas para la próxima ejecución...");
    } catch (error) {
        console.error("Error en el script:", error);
    }
}

setInterval(main, 24 * 60 * 60 * 1000);

main();
