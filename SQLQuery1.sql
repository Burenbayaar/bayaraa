-- 1. Өмнөх хүснэгтүүд байгаа бол устгах (Дараалал маш чухал!)
IF OBJECT_ID('order_items', 'U') IS NOT NULL DROP TABLE order_items;
IF OBJECT_ID('orders', 'U') IS NOT NULL DROP TABLE orders;
IF OBJECT_ID('products', 'U') IS NOT NULL DROP TABLE products;
IF OBJECT_ID('categories', 'U') IS NOT NULL DROP TABLE categories;
IF OBJECT_ID('admins', 'U') IS NOT NULL DROP TABLE admins;
GO

-- 2. Админ нэвтрэх эрхийн хүснэгт
CREATE TABLE admins (
    id INT PRIMARY KEY IDENTITY(1,1),
    username NVARCHAR(50) NOT NULL UNIQUE,
    password NVARCHAR(50) NOT NULL
);
GO

-- 3. Цэцгийн ангилал (Categories)
CREATE TABLE categories (
    id INT PRIMARY KEY IDENTITY(1,1),
    name_mn NVARCHAR(100) NOT NULL
);
GO

-- 4. Цэцэгс (Products)
CREATE TABLE products (
    id INT PRIMARY KEY IDENTITY(1,1),
    name_mn NVARCHAR(255) NOT NULL,
    price DECIMAL(18, 2) NOT NULL,
    main_image NVARCHAR(MAX),
    description_mn NVARCHAR(MAX),
    category_id INT FOREIGN KEY REFERENCES categories(id)
);
GO

-- 5. Захиалгын ерөнхий мэдээлэл (Orders)
CREATE TABLE orders (
    id INT PRIMARY KEY IDENTITY(1,1),
    customer_name NVARCHAR(100),
    phone NVARCHAR(20) NOT NULL,
    address NVARCHAR(MAX),
    total_amount DECIMAL(18, 2),
    -- Төлөвийг Монголоор харагдахаар DEFAULT утгыг нь тохирууллаа
    status NVARCHAR(50) DEFAULT N'Шалгагдаж байна', 
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- 6. Захиалгын доторх бараанууд (Order Items)
CREATE TABLE order_items (
    id INT PRIMARY KEY IDENTITY(1,1),
    order_id INT FOREIGN KEY REFERENCES orders(id),
    product_id INT FOREIGN KEY REFERENCES products(id),
    quantity INT DEFAULT 1,
    price DECIMAL(18, 2)
);
GO

-- ---------------------------------------------------------
-- 7. ЖИШЭЭ ӨГӨГДӨЛ ОРУУЛАХ (TEST DATA)
-- ---------------------------------------------------------

-- Админ нэмэх
INSERT INTO admins (username, password) VALUES ('admin', '85570354');

-- Ангилал нэмэх
INSERT INTO categories (name_mn) 
VALUES (N'Сарнай'), (N'Баглаа цэцэг'), (N'Тасалгааны цэцэг'), (N'Хуримын цэцэг');

-- Жишээ цэцэгс нэмэх (Эхний ээлжинд харагдах цэцэгтэй байхын тулд)
-- Ангиллын ID-г 1, 2 гэж таарууллаа
INSERT INTO products (name_mn, price, main_image, description_mn, category_id)
VALUES 
(N'Улаан сарнайн баглаа', 85000, 'https://images.unsplash.com/photo-1548610762-656037911142?w=500', N'Тансаг зэрэглэлийн 11 улаан сарнай', 1),
(N'Цагаан сарнайн баглаа', 75000, 'https://images.unsplash.com/photo-1561181286-d3fea73e413f?w=500', N'Цэвэр ариун байдлын илэрхийлэл', 1),
(N'Хаврын баглаа', 65000, 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=500', N'Олон төрлийн цэцэг холилдсон шинэлэг баглаа', 2);

-- ---------------------------------------------------------
-- 8. ШАЛГАХ
-- ---------------------------------------------------------
SELECT * FROM admins;
SELECT * FROM categories;
SELECT * FROM products;
SELECT * FROM orders;