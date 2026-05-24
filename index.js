const express = require('express');
require('dotenv').config();
const sql = require('mssql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

// =========================
// 1. Uploads хавтас бэлдэх
// =========================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// =========================
// 2. Middleware
// =========================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTML, CSS, JS файлуудыг шууд serve хийнэ
app.use(express.static(__dirname));

// Upload зураг serve хийнэ
app.use('/uploads', express.static(uploadsDir));

// =========================
// 3. SQL тохиргоо
// =========================
// Анхаарах нь:
// - instanceName-ийг АВЧ ХАЯСАН
// - шууд TCP 1433 портоор холбож байна
// - энэ нь SQL чинь 1433 дээр сонсож байгаа үед ажиллана
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;

// DB pool авах helper
async function getPool() {
    if (pool && pool.connected) return pool;
    pool = await sql.connect(dbConfig);
    return pool;
}

// =========================
// 4. Multer тохиргоо
// =========================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const safeExt = path.extname(file.originalname || '').toLowerCase();
        cb(null, `${Date.now()}${safeExt}`);
    }
});

const upload = multer({ storage });

// =========================
// 5. API
// =========================

// Root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await getPool();
        res.json({ success: true, message: 'Server + DB OK' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🔐 Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Нэвтрэх нэр болон нууц үг шаардлагатай.'
        });
    }

    try {
        const db = await getPool();
        const result = await db.request()
            .input('u', sql.NVarChar(50), username)
            .input('p', sql.NVarChar(50), password)
            .query(`
                SELECT id, username
                FROM admins
                WHERE username = @u AND password = @p
            `);

        if (result.recordset.length > 0) {
            return res.json({
                success: true,
                user: result.recordset[0]
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Нэвтрэх нэр эсвэл нууц үг буруу!'
        });
    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 📁 Categories
app.get('/api/categories', async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request()
            .query('SELECT * FROM categories ORDER BY id ASC');

        res.json(result.recordset);
    } catch (err) {
        console.error('❌ Categories error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 🌸 Products list
app.get('/api/products', async (req, res) => {
    const { category_id } = req.query;

    try {
        const db = await getPool();
        const request = db.request();

        let query = 'SELECT * FROM products';

        if (category_id) {
            request.input('cid', sql.Int, Number(category_id));
            query += ' WHERE category_id = @cid';
        }

        query += ' ORDER BY id DESC';

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('❌ Products fetch error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ➕ Product add
app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const { name, price, desc, category_id } = req.body;

        if (!name || !price || !category_id) {
            return res.status(400).json({
                success: false,
                message: 'Нэр, үнэ, ангилал шаардлагатай.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Зураг оруулна уу.'
            });
        }

        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        const db = await getPool();
        await db.request()
            .input('n', sql.NVarChar(255), name)
            .input('p', sql.Decimal(18, 2), Number(price))
            .input('i', sql.NVarChar(sql.MAX), imageUrl)
            .input('d', sql.NVarChar(sql.MAX), desc || '')
            .input('c', sql.Int, Number(category_id))
            .query(`
                INSERT INTO products (name_mn, price, main_image, description_mn, category_id)
                VALUES (@n, @p, @i, @d, @c)
            `);

        res.json({
            success: true,
            message: 'Бүтээгдэхүүн амжилттай нэмэгдлээ.',
            imageUrl
        });
    } catch (err) {
        console.error('❌ Product add error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 🗑️ Product delete
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const db = await getPool();
        await db.request()
            .input('id', sql.Int, Number(id))
            .query('DELETE FROM products WHERE id = @id');

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Product delete error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 🛒 Order create
app.post('/api/orders', async (req, res) => {
    const { customer_name, phone, address, total_amount, items } = req.body;

    if (!customer_name || !phone || !address || !total_amount || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Захиалгын мэдээлэл дутуу байна.'
        });
    }

    let transaction;

    try {
        const db = await getPool();
        transaction = new sql.Transaction(db);
        await transaction.begin();

        const orderRequest = new sql.Request(transaction);
        const orderResult = await orderRequest
            .input('name', sql.NVarChar(100), customer_name)
            .input('phone', sql.NVarChar(20), phone)
            .input('address', sql.NVarChar(sql.MAX), address)
            .input('total', sql.Decimal(18, 2), Number(total_amount))
            .query(`
                INSERT INTO orders (customer_name, phone, address, total_amount, status, created_at)
                OUTPUT INSERTED.id
                VALUES (@name, @phone, @address, @total, N'Шалгагдаж байна', GETDATE())
            `);

        const orderId = orderResult.recordset[0].id;

        for (const item of items) {
            const productId = Number(item.product_id || item.id);
            const quantity = Number(item.quantity || 1);
            const price = Number(item.price);

            const itemRequest = new sql.Request(transaction);
            await itemRequest
                .input('oid', sql.Int, orderId)
                .input('pid', sql.Int, productId)
                .input('qty', sql.Int, quantity)
                .input('price', sql.Decimal(18, 2), price)
                .query(`
                    INSERT INTO order_items (order_id, product_id, quantity, price)
                    VALUES (@oid, @pid, @qty, @price)
                `);
        }

        await transaction.commit();

        res.json({
            success: true,
            orderId
        });
    } catch (err) {
        if (transaction) {
            try { await transaction.rollback(); } catch (_) {}
        }

        console.error('❌ Order create error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 🔍 Order check by ID + phone
app.get('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { phone } = req.query;

    try {
        const db = await getPool();
        const result = await db.request()
            .input('id', sql.Int, Number(id))
            .input('phone', sql.NVarChar(20), phone || '')
            .query(`
                SELECT * FROM orders
                WHERE id = @id AND phone = @phone
            `);

        if (result.recordset.length > 0) {
            return res.json({
                success: true,
                order: result.recordset[0]
            });
        }

        res.status(404).json({
            success: false,
            message: 'Захиалга олдсонгүй'
        });
    } catch (err) {
        console.error('❌ Order check error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 📦 Admin orders
app.get('/api/admin/orders', async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request()
            .query('SELECT * FROM orders ORDER BY created_at DESC');

        res.json(result.recordset);
    } catch (err) {
        console.error('❌ Admin orders error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 🔎 Order items
app.get('/api/admin/orders/:id/items', async (req, res) => {
    const { id } = req.params;

    try {
        const db = await getPool();
        const result = await db.request()
            .input('oid', sql.Int, Number(id))
            .query(`
                SELECT oi.*, p.name_mn
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = @oid
                ORDER BY oi.id DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error('❌ Order items error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 📝 Order status update
app.put('/api/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({
            success: false,
            message: 'Status шаардлагатай.'
        });
    }

    try {
        const db = await getPool();
        await db.request()
            .input('id', sql.Int, Number(id))
            .input('s', sql.NVarChar(50), status)
            .query('UPDATE orders SET status = @s WHERE id = @id');

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Order status update error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// 🗑️ Order delete
app.delete('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    let transaction;

    try {
        const db = await getPool();
        transaction = new sql.Transaction(db);
        await transaction.begin();

        await new sql.Request(transaction)
            .input('id', sql.Int, Number(id))
            .query('DELETE FROM order_items WHERE order_id = @id');

        await new sql.Request(transaction)
            .input('id', sql.Int, Number(id))
            .query('DELETE FROM orders WHERE id = @id');

        await transaction.commit();
        res.json({ success: true });
    } catch (err) {
        if (transaction) {
            try { await transaction.rollback(); } catch (_) {}
        }

        console.error('❌ Order delete error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// =========================
// 6. Server асаах
// =========================
async function startServer() {
    try {
        await getPool();

        console.log('-------------------------------------------');
        console.log(`🚀 FLORA API Сервер аслаа: http://localhost:${PORT}`);
        console.log('📦 DB: tsetsgiin_delguur | TCP Port: 1433');
        console.log('-------------------------------------------');

        app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('❌ SQL connection error:', err.message);
        console.error('⚠️ SQL Server TCP/IP 1433 дээр ажиллаж байгаа эсэхээ шалга.');
    }
}

startServer();