const xmlrpc = require('xmlrpc');
const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
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
    try {
        const uid = await new Promise((resolve, reject) => {
            common.methodCall(
                'authenticate',
                [ODOO_BD, ODOO_USERNAME, ODOO_PASSWORD, {}],
                (error, uid) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(uid);
                    }
                }
            );
        });
        // console.log('Autenticación exitosa en Odoo. UID:', uid);
        return uid;
    } catch (error) {
        console.error('Error al autenticar en Odoo:', error);
        throw error;
    }
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

async function obtenerDatos(uid) {
    const modelos = [
        { nombre: 'account.move', campos: ['id', 'name', 'sequence_prefix', 'sequence_number', 'invoice_date', 'create_date', 'invoice_date_due', 'l10n_pe_edi_operation_type', 'partner_id', 'currency_id', 'amount_untaxed', 'amount_tax', 'amount_total', 'edi_state', 'reversed_entry_id', 'ref', 'l10n_pe_edi_refund_reason'] },
        { nombre: 'res.partner', campos: ['id', 'name', 'vat', 'street', 'street2', 'city', 'state_id', 'country_id', 'zip', 'email', 'phone', 'mobile', 'website', 'ref'] },
        { nombre: 'account.move.line', campos: ['product_id'] }
    ];

    const dominio = [];
    const datos = {};

    for (const modelo of modelos) {
        datos[modelo.nombre] = await fetchDatosOdoo(uid, modelo.nombre, dominio, modelo.campos);
    }

    return datos;
}

(async () => {
    try {
        const uid = await autenticarEnOdoo();
        if (!uid) {
            console.error('No se pudo autenticar en Odoo.');
            return;
        }

        const datosCombinados = await obtenerDatos(uid);

        // const outputFile = 'datos_odoo.json';
        // fs.writeFileSync(outputFile, JSON.stringify(datosCombinados, null, 2), 'utf8');
        // console.log('Datos guardados en', outputFile);
    } catch (error) {
        console.error('Error durante la ejecución:', error);
    }
})();

// async function processData() {
//     try {
//         const uid = await autenticarEnOdoo();
//         if (!uid) {
//             console.error('No se pudo autenticar en Odoo.');
//             return;
//         }

//         const camposAccountMove = [
//             'id',
//             'name',
//             'sequence_prefix',
//             'sequence_number',
//             'invoice_date',
//             'create_date',
//             'invoice_date_due',
//             'l10n_pe_edi_operation_type',
//             'partner_id',
//             'currency_id',
//             'amount_untaxed',
//             'amount_tax',
//             'amount_total',
//             'edi_state',
//             'reversed_entry_id',
//             'ref',
//             'l10n_pe_edi_refund_reason',
//         ];

//         const dominio = [];

//         const datos = await fetchDatosOdoo(uid, 'account.move', dominio, camposAccountMove);
//         console.log('Datos obtenidos de Odoo:', datos);

//         const client = new Client({
//             user: process.env.PG_USER,
//             host: process.env.PG_HOST,
//             database: process.env.PG_DATABASE,
//             password: process.env.PG_PASSWORD,
//             port: Number(process.env.PG_PORT),
//         });

//         await client.connect();
//         console.log('Conectado a PostgreSQL');

//         for (const dato of datos) {
//             const query = `
//             INSERT INTO account_moves (
//                 id,
//                 name,
//                 sequence_prefix,
//                 sequence_number,
//                 invoice_date,
//                 create_date,
//                 invoice_date_due,
//                 l10n_pe_edi_operation_type,
//                 partner_id,
//                 currency_id,
//                 amount_untaxed,
//                 amount_tax,
//                 amount_total,
//                 edi_state,
//                 reversed_entry_id,
//                 ref,
//                 l10n_pe_edi_refund_reason
//             )
//             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
//             ON CONFLICT (id) DO UPDATE SET
//                 name = EXCLUDED.name,
//                 sequence_prefix = EXCLUDED.sequence_prefix,
//                 sequence_number = EXCLUDED.sequence_number,
//                 invoice_date = EXCLUDED.invoice_date,
//                 create_date = EXCLUDED.create_date,
//                 invoice_date_due = EXCLUDED.invoice_date_due,
//                 l10n_pe_edi_operation_type = EXCLUDED.l10n_pe_edi_operation_type,
//                 partner_id = EXCLUDED.partner_id,
//                 currency_id = EXCLUDED.currency_id,
//                 amount_untaxed = EXCLUDED.amount_untaxed,
//                 amount_tax = EXCLUDED.amount_tax,
//                 amount_total = EXCLUDED.amount_total,
//                 edi_state = EXCLUDED.edi_state,
//                 reversed_entry_id = EXCLUDED.reversed_entry_id,
//                 ref = EXCLUDED.ref,
//                 l10n_pe_edi_refund_reason = EXCLUDED.l10n_pe_edi_refund_reason;
//         `;

//             const values = [
//                 dato.id || null,
//                 dato.name || null,
//                 dato.sequence_prefix || null,
//                 dato.sequence_number || null,
//                 dato.invoice_date || null,
//                 dato.create_date || null,
//                 dato.invoice_date_due || null,
//                 dato.l10n_pe_edi_operation_type || null,
//                 dato.partner_id ? dato.partner_id[0] : null,
//                 dato.currency_id ? dato.currency_id[0] : null,
//                 dato.amount_untaxed || null,
//                 dato.amount_tax || null,
//                 dato.amount_total || null,
//                 dato.edi_state || null,
//                 dato.reversed_entry_id || null,
//                 dato.ref || null,
//                 dato.l10n_pe_edi_refund_reason || null,
//             ];

//             await client.query(query, values);
//         }

//         console.log('Datos insertados/actualizados en la base de datos');
//         await client.end();
//     } catch (error) {
//         console.error('Error procesando datos:', error);
//     }
// }

// processData();

// async function main() {
//     try {
//         console.log("Inicio de ejecución del script...");
//         await processData();
//         console.log("Ejecución completada. Esperando 24 horas para la próxima ejecución...");
//     } catch (error) {
//         console.error("Error en el script:", error);
//     }
// }

// setInterval(main, 24 * 60 * 60 * 1000);

// main();
