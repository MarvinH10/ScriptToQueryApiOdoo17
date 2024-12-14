const xmlrpc = require('xmlrpc');
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
                    console.error('Error al autenticar en Odoo:', error);
                    reject(error);
                } else {
                    console.log('Autenticación exitosa en Odoo. UID:', uid);
                    resolve(uid);
                }
            }
        );
    });
}

async function fetchDatosOdoo(uid, model, method, domain = [], fields = []) {
    return new Promise((resolve, reject) => {
        object.methodCall(
            'execute_kw',
            [ODOO_BD, uid, ODOO_PASSWORD, model, method, [domain], { fields }],
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

        const productos = await fetchDatosOdoo(uid, 'product.template', 'search_read', [], [
            'id',
            'name',
            'barcode',
            'list_price',
        ]);

        console.log('Productos obtenidos:', productos);
    } catch (error) {
        console.error('Error durante la ejecución:', error);
    }
})();

// async function processData() {
//     try {
//         await autenticarEnOdoo17();

//         const productos = await fecthDatosOdoo17('/product.product', { limit: 100 }); // POR AHORA PONDREMOS DE LIMITE 100 PROCESOS DE DATOS

//         console.log('Datos obtenidos de Odoo 17:', productos);

//         // DATOS DEL POSTGRESS SQL
//         const client = new Client({
//             user: process.env.PG_USER,
//             host: process.env.PG_HOST,
//             database: process.env.PG_DATABASE,
//             password: process.env.PG_PASSWORD,
//             port: Number(process.env.PG_PORT),
//         });

//         await client.connect();
//         console.log('Conectado a PostgreSQL');

//         for (const producto of productos) {
//             const query = `
//                 INSERT INTO productos (id, name, barcode, price)
//                 VALUES ($1, $2, $3, $4)
//                 ON CONFLICT (id) DO UPDATE SET
//                 name = EXCLUDED.name,
//                 barcode = EXCLUDED.barcode,
//                 price = EXCLUDED.price;`;

//             const values = [
//                 producto.id,
//                 producto.name,
//                 producto.barcode,
//                 producto.price,
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
